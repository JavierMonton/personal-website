# From Kafka to an RDS
Complete guide to move data from Kafka to an RDS using Kafka Connect and the JDBC Sink Connector.

## Kafka Connect deployment
For these examples, we are using the Confluent's Kafka Connect on its Docker version, as we are going to deploy it in a Kubernetes cluster.

### Single and distributed modes

Kafka Connect comes with two modes of execution, single and distributed. The main difference between them is that the single mode runs all the connectors in the same JVM, while the distributed mode runs each connector in its own JVM. The distributed mode is the recommended one for production environments, as it provides better scalability and fault tolerance. 
In the case of K8s, it means we will be using more than one pod to run Kafka Connect.

:::warn
Be aware that these two modes are using different class paths, so if you are doing changes inside the docker and you are running the single mode in local but distributed in production, you might have different results.
I strongly recommend to check manually which are the class paths in each case using something like 
```bash
ps aux | grep java
```
And  you will get something like this:
```bash
java -Xms256M -Xmx2G -server -XX:+UseG1GC -XX:MaxGCPauseMillis=20 -XX:InitiatingHeapOccupancyPercent=35 -XX:+ExplicitGCInvokesConcurrent -XX:MaxInlineLevel=15 -Djava.awt.headless=true -Dcom.sun.management.jmxremote=true -Dcom.sun.management.jmxremote.authenticate=false -Dcom.sun.management.jmxremote.ssl=false -Dkafka.logs.dir=/var/log/kafka -Dlog4j.configuration=file:/etc/kafka/connect-log4j.properties -cp /etc/kafka-connect/jars/*:/usr/share/java/kafka/*:/usr/share/java/confluent-common/*:/usr/share/java/kafka-serde-tools/*:/usr/share/java/monitoring-interceptors/*:/usr/bin/../share/java/kafka/*:/usr/bin/../share/java/confluent-telemetry/* org.apache.kafka.connect.cli.ConnectDistributed /etc/kafka-connect/kafka-connect.properties
```
And you'll find all the directories (after `-cp`) included in the running Kafka Connect. 

- Note that a folder called `cp-base-new` is widely used in the Single mode, but not very well documented.
- Setting your deployment to 1 replicas will run Kafka Connect in Single mode, while setting it to 2 or more will run it in Distributed mode.
:::

### Deploying in K8s
This should be fairly straightforward, as we are using the Confluent's Kafka Connect Docker image, which is already prepared to be deployed in K8s.
Confluent provides a [Helm chart](https://github.com/confluentinc/cp-helm-charts/blob/master/charts/cp-kafka-connect/README.md) as example, so it should be easy. You can also create your own.

### Using MSK (Kafka)
If you are using the AWS's Kafka version, MSK, and you are authenticating using IAM, you will need to do a few things:
- Configure some environment variables in Kafka Connect 
- Add the required AWS libraries to the class path

#### Environment variables
`CONNECT_BOOTSTRAP_SERVERS` will have the brokers, as usual, but using the `9098` port.

You need to specify the IAM callback handler as well as SASL:
```bash
CONNECT_SASL_CLIENT_CALLBACK_HANDLER_CLASS = software.amazon.msk.auth.iam.IAMClientCallbackHandler
CONNECT_SASL_MECHANISM = AWS_MSK_IAM
CONNECT_SECURITY_PROTOCOL = SASL_SSL
```
And also you have to provide a `JAAS` file with the credentials. You can find more info about this in the [AWS's documentation](https://docs.aws.amazon.com/msk/latest/developerguide/msk-password.html#msk-password-sasl-plain).
For IAM, something like this should work:
```bash
CONNECT_SASL_JAAS_CONFIG = 
      software.amazon.msk.auth.iam.IAMLoginModule required
      awsRoleArn="arn:aws:iam::{account}:role/{role}"
      awsStsRegion="{region}";
```
If you do this in yaml for Helm, it will look like this:

```yaml
  - name: CONNECT_SASL_JAAS_CONFIG
    value: >-
      software.amazon.msk.auth.iam.IAMLoginModule required
      awsRoleArn="arn:aws:iam::{account}:role/{role}"
      awsStsRegion="{region}";
```

When Kafka Connect creates a new connector, it will use its own credentials configuration, so if you want to have the same IAM auth, you will need to add the same values to these environment variables:
- `CONNECT_CONSUMER_SASL_CLIENT_CALLBACK_HANDLER_CLASS`
- `CONNECT_CONSUMER_SASL_MECHANISM`
- `CONNECT_CONSUMER_SECURITY_PROTOCOL`
- `CONNECT_CONSUMER_SASL_JAAS_CONFIG`

:::tip
If you are using your own Helm template, you could create some variables for these values, so you can reuse them in the different environment variables, to avoid writing them twice.
:::
  
### Formatting logs as JSON
Logs are very important, and having a good format is key to be able to read and process them easily. Usually, in production we could want to have them as JSON, and Kafka Connect does not make it as easy for us as we might expect.

If you only want to change the log level or format your logs a bit, you could use the environment variables available for that, they are [described in their docs](https://docs.confluent.io/platform/current/connect/logging.html#use-environment-variables-docker)
but if you want to proper format all logs as JSON, you will need to do a few more things.

#### Using JSONEventLayoutV1
Kafka Connect uses `log4j1` (not `log4j2`), so we will need to use a `log4j.properties` file to configure it. They are using a patched version of the original Log4j1 that is supposed to fix some vulnerabilities.

We can use a dependency that automatically converts all of our logs into JSON, like [log4j-jsonevent-layout](https://github.com/logstash/log4j-jsonevent-layout). See [Adding libraries](#adding-libraries) for more info about how to add new libraries.
If we have this library in the classpath, we can now use the `JSONEventLayoutV1` in our `log4j.properties` file. Like:

```properties
log4j.appender.stdout=org.apache.log4j.ConsoleAppender
log4j.appender.stdout.layout=net.logstash.log4j.JSONEventLayoutV1
```

#### Properties files
Confluent will tell you that you can modify the template for logs in `/etc/confluent/docker/log4j.properties.template`, but you might need some extra steps if you want __all__ logs as JSON.

- Template for most of the logs, as described, in `/etc/confluent/docker/log4j.properties.template`
- Logs from the "Admin Client" in `/etc/kafka/log4j.properties`
- Some tool logs in `/etc/confluent/docker/tools-log4j.properties.template`
- Some startup logs in `/etc/kafka-connect/log4j.properties`
- There are also some random logs not using Log4j, they are defined in `/usr/lib/jvm/jre/conf/logging.properties`

If you want to format everything to JSON, I would recommend to enter inside the docker image, look for those files, and change them as desired. Your Dockerfile could then replace them while creating the image.

:::warn
There are still some logs during the start-up not formatted as JSON. Confluent's Kafka Connect is using a [Python script to start up the service](https://github.com/confluentinc/confluent-docker-utils/blob/master/confluent/docker_utils/cub.py), 
and that service is using some `prints` that does not belong to any Log4j, so they are not formatted in any way.

If you want to format those `prints` too, you will need to do something else as they don't have any configuration file. You could use a `sed` command to replace them, or you could modify the `cub.py` file in your image with the desired format.
:::


### Adding plugins
Adding plugins should be straightforward, the documentation explains pretty well how to do it. Note that you can add plugins inside the plugins folder or you could modify the plugins folder with 
```
plugin.path=/usr/local/share/kafka/plugins
```

In any case, copying and pasting files into a Docker can limit a bit the flexibility of the solution, so I would recommend building a project where you can add all the dependencies that you need, meaning that libraries and plugins can be built and copied inside the Docker during the CI. 
By doing this, you will be able to use Gradle, Maven, SBT or any other building tool to manage your dependencies, upgrade versions and build plugins.

:::tip
Note that Plugins and libraries are not included in the same path, so I would recommend to build a different project for each. 
For example, we could build a main project that can build the Kafka Connect image with their libraries and a subproject that can build plugins in a different folder. Then, the Dockerfile could easily copy both folders into the image in the right paths.
:::

If you build a project like that, in order to add the JDBC plugin, for example, in Gradle you only need to add this:
```
dependencies {
    implementation("io.confluent:kafka-connect-jdbc:10.7.4")
}
```

### Adding libraries
As mentioned earlier, libraries must go in the class-path, not in the plugins' folder. 
If you are using a project to build your libraries and plugins, you could use many different plugins to pack all the dependencies into a .jar that you can be copied into the Docker image.

For example, with Gradle we could include the AWS library needed for IAM authentication, and the Log4j JSON formatter, like this:
```
dependencies {
    implementation("software.amazon.msk:aws-msk-iam-auth:1.1.7")
    implementation("net.logstash.log4j:jsonevent-layout:1.7")
}
```
And using a plugin to build a fatJar, everything should be included in one .jar file that we can copy into the Docker image.

:::tip
For the JDBC Sink, we will need to also include a Driver and more libraries in case we want to use IAM Auth with RDS, we will see that later.
:::

### Kafka Connect REST API
By default, Kafka Connect exposes its REST API in the port `8083`. You can find more info about the API in the [official documentation](https://docs.confluent.io/platform/current/connect/references/restapi.html).

If you want to control who can access the API or change its port, you can use the `CONNECT_LISTENERS` and/or `CONNECT_REST_ADVERTISED_PORT` environment variables. 
For example, if you want to change the port to `8084`, you could do this:

```bash
  - name: CONNECT_REST_ADVERTISED_PORT
    value: "8084"
```
Also, you can even open the API in multiple ports, by doing this:
```bash
  - name: CONNECT_LISTENERS
    value: "http://0.0.0.0:8084,http://0.0.0.0:8085"
  - name: CONNECT_REST_ADVERTISED_PORT
    value: "8084"
```

#### Securing the API
Kafka Connect's REST API lacks of security options, it only allows you to use a basic authentication, which might not be what you are looking for. Also, the code seems to have several places where they do an `if - else` to check if basic auth is enabled or not.

But, there is also another way we can use to build our own security layer. 

##### JAX-RS Security Extensions
Without entering too much into details, Kafka Connect, as well as Schema Registry, are using [JAX-RS](https://en.wikipedia.org/wiki/Jakarta_RESTful_Web_Services) to build their REST APIs, and JAX-RS allows us to add our own security extensions.
Following this pattern, we could add a simple filter to check if the user is authenticated or not, and if not, we could return a `401` error.

About how to authenticate a user, we could use different methods, depending on our setup. For example, we could use AWS IAM API to check if a user has permissions or not, or as we are deploying this in Kubernetes, we could rely on [Kubernetes identities](https://learnk8s.io/microservices-authentication-kubernetes) which will allow us to authenticate pods using a JWT token.

To do this, you have to create a JAX-RS plugin and then register it in Kafka Connect. Once your plugin is ready, you can register it by extending `ConnectRestExtension`:
```scala
class MySecurityExtension extends ConnectRestExtension {}
```
This class will need to be packed with your libraries and included in the class path, as we did with other libraries.


## JDBC Sink Connector

We need to download the plugin and add it inside the plugins folder. By default, it's `/usr/share/confluent-hub-components/`. 

You can get the .jar with `wget` and copy it inside the Docker image, in the aforementioned folder. Or, as suggested earlier, if you are building a project using a building tool, like Gradle, you can use Maven to download all the plugins you might need. We only need to add the dependency:
```
dependencies {
    implementation("io.confluent:kafka-connect-jdbc:10.7.4")
}
```
And build the .jar. Then, we can copy it inside the Docker image.

### Drivers
Only the plugin is not enough to connect to a database, we will also need the driver. In our case, we are using PostgreSQL RDS ,so we will need the driver for Postgres.
:::info
Several drivers are already included in the Kafka Connect image, but they are not inside the default classpath, so if we try to run the connector without adding the driver properly, we will get an error like `No suitable driver found`.
They are placed in `/usr/share/confluent-hub-components/`, but as we can see using something like `ps aux | grep java`, they are not included in the classpath. So, we have three options:
- Move the driver to the classpath
- Add the drivers' folder to the classpath
- Find our own driver and copy it inside the Docker image, in the classpath
:::

I would go for the third option, that gives us more flexibility about which version of the driver we want to use. 

So, we can download the driver and pack it with our libraries, and then copy it inside the Docker image:
```
implementation("org.postgresql:postgresql:42.7.1")
```

:::tip
Note that the JDBC Sink has to be placed in `plugins` folder, while the driver has to be placed in the `library` classpath.
:::

### IAM Auth
If you are using IAM Auth with RDS, you will need to add some extra libraries to the classpath. You can find more info about this in the [AWS's documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.Connecting.Java.html).

The bad news is that a simple driver can not use IAM Auth, if you try to connect to the database using IAM Auth, you will get an error like `The server requested password-based authentication, but no password was provided.`. You would need to create a token manually and pass it through the connection.

The good news is that there is a library created by AWS that acts as a [wrapper for your JDBC Drivers](https://github.com/awslabs/aws-advanced-jdbc-wrapper), adding extra features, including IAM Auth.

To use IAM Auth, we only need to add this driver to the classpath, and change a bit our JDBC URL.


Add the dependency (also needed libraries for AWS RDS):
```
implementation("com.github.awslabs:aws-advanced-jdbc-wrapper:2.3.2")
implementation("software.amazon.awssdk:rds:2.20.145")
```

You can follow their docs, but in our case, we will need to change the JDBC URL to add a couple of things:
- URL using the new driver
- IAM Auth enabled flag enabled

```
jdbc:aws-wrapper:postgresql://{host}:{port}/postgres?wrapperPlugins=iam
```
:::tip
Some tips:
- This JDBC URL goes inside the connector's configuration
- A username is still required, and it should be the same as the role used to connect to the database
- You can also help the wrapper to find the dialect used, by adding `&wrapperDialect=rds-pg`
- You can also help Kafka Connect to find the dialect used, by adding another property in your connector's configuration: `dialectName: "PostgreSqlDatabaseDialect"`
:::

#### META-INF/services and multiple drivers
At this point, we are including the JDBC PostgreSQL driver and the wrapper in the classpath, both are JDBC Drivers, if we are including different .jar files, everything should be fine,
but if we are building a fat-jar, we might have some issues. Each one of these drivers is creating a file called `META-INF/services/java.sql.Driver`,
and they are including the name of the driver in it. If our fat-jar is not merging them to include both classes, we will get an error like `No suitable driver found`.

Depending on the building tool and the plugin used, we might need to add some extra configuration to merge these files. For example, in Gradle we could need to add something like this:
```
mergeServiceFiles()
```
Or in the SBT Assembly plugin, we could need to add something like:
```sbt
assembly / assemblyMergeStrategy := MergeStrategy.concat
```


### Topic & Destination table
The JDBC Sink Connector allows us to decide which topics and tables we want to use, and we have two ways of doing it:
- One topic / table per connector. In this case, we can directly write the topic and table names in the connector's configuration.
- Multiple topics / tables per connector. In this case, we will need to use a pattern for topics and another for tables.

#### One topic / table per connector
This is the easiest way, we only need to add the topic and table names in the connector's configuration, like this:
```yaml
topics: "my.first.topic"
table.name.format: "first_table"
```


### Using patterns for topics and table names
The JDBC does some magic to map topics to tables, but it's not always what we want. For example, if we have a topic called `my.topic` it will take `my` as schema name and `topic` as table name. More details about [table parsing](https://docs.confluent.io/kafka-connectors/jdbc/current/sink-connector/overview.html#table-parsing) can be found in their docs.

But, it's likely that we use a pattern for our topics, specially if we are building a Datalake, so we might want to create tables based in a different pattern. For example, we could have a topic called `my.first.topic` and we want to create a table called `first_table` in our database. This can still be achieved using a `router` and a `table.name.format` property.


:::tip
Be aware that not all types accepted in your Kafka topics are accepted in your database, JDBC Driver and/or the JDBC Sink. For example, the list of valid types from the perspective of the [JDBC Sink are here](https://github.com/confluentinc/kafka-connect-jdbc/blob/master/src/main/java/io/confluent/connect/jdbc/dialect/PostgreSqlDatabaseDialect.java#L299).
:::
```
```



## Deploy new connectors in K8s
Deploying new connectors can be tricky, specially if you are using Kubernetes. Kafka Connect exposes an API that we can use to create new connectors, but we have to "manually" do some calls to it in order to create, update or delete connectors. This is not the best way of integrating something on our CI/CD, specially if our CI is running outside our K8s cluster.

Ideally, we would want to have a configuration file in our repository, that can be updated and automatically deployed during our CI.

### Using the connect-operator

There is a solution for this, the Confluent's [connect-operator](https://github.com/confluentinc/streaming-ops/tree/main/images/connect-operator), although the solution is not very robust, is does the job.

This is based on the [shell-operator](https://github.com/flant/shell-operator), a Kubernetes operator that can be deployed in our cluster and configured to "listen" for specific events, like new deployments, changes in config maps or whatever we want.
Specifically, this `connect-operator` is designed to listen for changes in a config map, and then it will create, update or delete connectors based on the content of that config map.

In other words, we can put our Connector's configuration in a config map, and then the `connect-operator` will create the connector for us.

:::tip
The `connect-operator` does not need to be deployed together with Kafka Connect, it is an independent pod that will be running in our cluster, 
it can be in the same namespace or not. It also can listen for config-maps attached to our Kafka Connect or to any other deployment, 
all depends on our configuration and K8s permissions.
:::

:::warn
The `connect-operator` is a nice tool that does the job, but it isn't very robust. For example, it does not check if a connector creation has failed or not, it only checks if the connector exists or not, sends a `curl` to the REST API, and then it assumes that everything is fine.
In any case, it is just a bash script using JQ for configuration, so it can be easily modified to fit our needs.
:::

#### Configuring the connect-operator
As the `connect-operator` is based on the `shell-operator`, it expects a configuration file in YAML format, where we can define the events we want to listen to.

By default, the operator is called in two ways:

- At startup, it will be called with a flag `--config` and it has to return the configuration file in YAML format that specifies the events we want to listen to.
- When an event is triggered, our script will be triggered with the event as a parameter.

##### Listening to config maps
The config that we have to return to listen for config map changes should se something similar to this:
```yaml
configVersion: v1
kubernetes:
- name: ConnectConfigMapMonitor
  apiVersion: v1
  kind: ConfigMap
  executeHookOnEvent: ["Added","Deleted","Modified"]
  jqFilter: ".data"
  labelSelector:
    matchLabels:
      destination: $YOUR_DESTINATION
  namespace:
    nameSelector:
      matchNames: ["$YOUR_NAMESPACE"]
```
`YOUR_DESTINATION` must be the same as the label used in the config map, and `YOUR_NAMESPACE` must be the same as the namespace where the config map is deployed.

:::info
The default `connect-operator` has a config to enable or disable the connector, but it is done in a way that will enable or disable all your connectors at once, so I prefer to skip that part as I want to have multiple connectors in my config maps.
:::

:::note
The configuration looks different from a standard K8s configuration, but the `shell-operator` can handle it and **there is no need to declare a new [CRD](https://helm.sh/docs/chart_best_practices/custom_resource_definitions/) with that structure.**
:::

##### Config Map
The config map must have the connectors configuration in JSON, in the same way you will use it in the REST API. 
I would suggest to build a Helm template for config maps, so you can write your connectors configuration in YAML and then convert it to JSON using Helm.


Something like this should work in Helm:
```yaml
{{- if .Values.configMap }}
apiVersion: v1
kind: ConfigMap
metadata:
  labels:
    destination: {{ .Values.your-deployment-name }} # this has to match with the label in the connect-operator config
data:
  {{- range $key, $value := .Values.configMap.data }}
    {{ $key }}: {{ $value | toJson | quote | indent 6 | trim }}
  {{- end }}
{{- end }}
```

After having this Helm template, we can write our Connector's config like this:
```yaml
configMap:
  data:
    my-connector-name:
      name: "my-connector-name"
      config:
        # JDBC Config
        name: "my-connector-name"
        connector.class: "io.confluent.connect.jdbc.JdbcSinkConnector"
        # using IAM Auth
        connection.url: "jdbc:aws-wrapper:postgresql://{host}:{port}/postgres?wrapperPlugins=iam&wrapperDialect=rds-pg"
        connection.user: env.USERNAME
        dialect.name: "PostgreSqlDatabaseDialect"
        topics: "my-topic"
        tasks.max: "4"
        # ...
```

:::tip
The config-map can be attached to your Kafka Connect deployment, or to any other deployment, what matters is that the `connect-operator` can find it.
:::

Once it is deployed as a config-map, the `connect-operator` will create the connector for us.

##### RBAC permissions to read config maps
If your `connect-operator` stays in a different deployment than the config-map, you will need to give it permissions to read the config map. This can be achieved using a Role and a RoleBinding using Helm.

Something like this needs to be created:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: {{ .Values.your-app }}-configmap-read-role
  namespace: {{ .Release.Namespace }}
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["list", "watch"] # List and Watch all configmaps, get only the ones specified in resourceNames
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames:
      ["your-destination"] # this is the deployment having the config-map
    verbs: ["get", "watch", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: {{ .Values.your-app }}-read-configmaps
  namespace: {{ .Release.Namespace }}
subjects:
  - kind: ServiceAccount
    name: {{ .Values.your-app }}
roleRef:
  kind: Role
  name: {{ .Values.your-app }}-configmap-read-role
  apiGroup: rbac.authorization.k8s.io
{{- end }}
```


### Custom Kafka groups for your connectors

By default, Kafka Connect will create a group for each connector, and it will use the connector's name as the group name, with `connect-` as prefix.
This is not very flexible, as we might want to have our own group names. For example, if we are sharing K8s clusters with other teams, 
we might want to have our own group names to avoid conflicts. Or we could have our own naming convention with ACLs in Kafka.

In order to decide a group name, we have to change two configurations:

First, we have to create an environment variable that allows us to override some configs, including the group name:
```bash
CONNECT_CONNECTOR_CLIENT_CONFIG_OVERRIDE_POLICY=All
```
:::tip
This can be on your deployment file or on your Dockerfile.
:::

Then, we can add the group name in our connector's configuration:
```yaml
consumer.override.group.id: "my-custom-group-name"
```






