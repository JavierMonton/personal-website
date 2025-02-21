---
slug: kafka-connect-protobuf
title: Kafka Connect - Protobuf Converters
authors: javier
tags: [kafka-connect, protobuf, source, sink, schema-registry]
---

# Kafka Connect & Protobuf

Kafka Connect is a tool that allows you to stream data between Apache Kafka and other systems, 
sometimes the data might be converted from Protobuf to something different, other times, it might be converted to Protobuf.

## Protobuf Converters
Confluent has a [Protobuf Converter](https://docs.confluent.io/platform/current/schema-registry/connect.html#protobuf) 
that can be used with any Kafka Connect Source or Sink, but it isn't as simple as it seems.

If you enable:

```properties
key.converter=io.confluent.connect.protobuf.ProtobufConverter
value.converter.schema.registry.url=http://localhost:8081
```

If you use this in a Sink connector, Kafka Connect will understand how to deserialize the Protobuf message in Kafka, but how will it write it to the sink?

If you enable this in a Source connector, Kafka Connect will be able to serialize the message to Protobuf, but what was it expecting from the Source?

In some connectors, like a JDBC, it might be obvious that the database has a proper schema defined, but in others, like S3 or SQS, there is no schema defined, so, how will Kafka Connect know how to read/write the data?

## How Converters work

Inside Kafka Connect, the data is represented using the classes in `org.apache.kafka.connect.data`, which can be `Struct`, 

## Sink & Protobuf Converter

In a Sink, the ProtobufConverter (the same as the Avro converter or any other) transforms the data read from Kafka into this [Struct](https://github.com/a0x8o/kafka/blob/master/connect/api/src/main/java/org/apache/kafka/connect/data/Struct.java) class, with its fields and schema.
From there, the Sink connector decides how to write these objects in the destination. If we use a destination that requires a schema, like an RDS, the connector will likely know (and probably need) how to write these `structs`.

If we use a plugin that writes into a schemaless system, like S3 or SQS, nothing prevents the connector from writing data other than JSON or similar. 
*The connector needs to transform the `struct` into JSON if that's what we want*.

## Source & Protobuf Converter
Here is where it gets tricky. If we use a Protobuf converter in a Source connector, we are telling the converter to transform the `Struct` into Protobuf, but the connector needs to produce this `Struct`. 
In a structured source, like an RDS, it is easy to know how to produce the `Struct`, but in a schemaless source, like S3 or SQS, it is not that easy, the Source connector should be expecting something like a JSON, and it will need to parse it properly, generating a `schema` and a `struct`, otherwise, the Protobuf converter won't know what to do.

At EF, we have [modified an SQS Source connector](https://github.com/efcloud/kafka-connect-sqs) to allow automatic conversions from JSON to `Struct`, so the Protobuf or any other converter can work properly.

:::warning
Note that parsing automatically JSONs to be converted into `Struct` or `Protobuf` is not trivial due to the light types of JSON. For example, a numeric Timestamp in JSON is no different from a numeric value, so you cannot know if it's a Timestamp or an Integer, or Long. JSON doesn't have enums, so a String cannot be converted into an `Enumeration` automatically, etc.
:::

But that's not all, *how will this Protobuf Converter interact with Schema Registry?* There are several issues depending on the configuration. 

## Schema Registry & Protobuf Converter

The Confluent's ProtobufConverter is designed to use the following configuration, which is the default one:

```properties
value.converter.auto.register.schemas=true
value.converter.use.latest.version=false
value.converter.latest.compatibility.strict=true
```

In this way, a Source Connector in Kafka Connect will produce a new Protobuf Schema, and it will register the Schema in Schema Registry. 
But the schema registered will be something similar to this:
```protobuf
syntax = "proto3";
message ConnectDefault1 {
  string id = 1;
  int32 value = 2;
  repeated string tags = 3;
  google.protobuf.Timestamp updatedAt = 4;
  ConnectDefault2 sub = 5;

  message ConnectDefault2 {
    string name = 1;
    string description = 2;
    int32 value = 3;
  }
}
```
As we can see, it decides to create messages named `ConnectDefault1` and `ConnectDefault2`, which are fine if we don't care much about controlling our own schemas.

If a new message has a different schema than the first registered, and it's not compatible (following our compatibility configurations), it will fail.


But, what happens if we don't want Kafka Connect to write the schema in Schema Registry? We could disable the option, so this will be our config:

```properties
value.converter.auto.register.schemas=false
value.converter.use.latest.version=true
value.converter.latest.compatibility.strict=true
```

In this situation, we are registering the schema on our side, maybe we are calling our main object `MainObject` rather than `ConnectDefault1`. But here is where the issues start to appear, the ProtobufConverter will try to validate the schema in Schema Registry, and it will fail, because it is expecting a `ConnectDefault1` and we are sending a `MainObject`.
We could solve this by using the [SetSchemaMetadata SMT](https://docs.confluent.io/kafka-connectors/transforms/current/setschemametadata.html#set-a-namespace-and-schema-name) to set the schema name and namespace. But we still have issues with the order of the fields, more details later.

So, maybe we can disable the `value.converter.latest.compatibility.strict=false` if we know the schemas are the same? 

We could do it, yes, then, the ProtobufConverter won't compare the schemas, it will serialize the message and send it to Kafka. 
If the message has exactly the same schema, it will work, if not, it will still send the message to Kafka. 

And probably **the worst scenario**, lets imagine that a new event comes with fields in different order. We know that the `Struct` holds information about the field names and types, so it shouldn't cause any issue. We also know that an input message in a format like JSON also specifies the field names, so far so good.
But, Protobuf cares about the order of the fields, not just about their names, and the `ProtobufConverter` doesn't know which the expected order. 
Look at the previous Protobuf definition, a new message might come with `id` and `value` in different order, the `ProtobufConverter` will produce a schema like this:

```protobuf
syntax = "proto3";
message ConnectDefault1 {
  int32 value = 1;
  string id = 2;
  repeated string tags = 3;
  google.protobuf.Timestamp updatedAt = 4;
  ConnectDefault2 sub = 5;

  message ConnectDefault2 {
    string name = 1;
    string description = 2;
    int32 value = 3;
  }
}
```
`id` and `value` are in different order. If we have the `value.converter.latest.compatibility.strict` set to `true`, this will cause an error, if we have it as `false`, the event will be produced to Kafka, but our consumers will read it wrong.

:::warning
Even if we use `value.converter.latest.compatibility.strict=true`, if we send a message that matches the schema in the order of the fields and their types, but not on the field names, it will still produce the message. For example, if our message looks like this:
```json
{
  "anotherfield": "12345",
  "value": 10,
  "tags": ["exampleTag1", "exampleTag2"],
  "updatedAt": "2023-10-01T12:34:56Z"
}
```
The `ProtobufConverter` will serialize this message and produce it in Kafka. When a consumer reads this, it will use the Schema in Schema Registry, 
which has `id` rather than `anotherfield`, it will show the data on it. 
This come become a big issue if our schema has a lot of fields with the same type, like `string`, 
if a message has unordered fields, they will end up mixed.
:::

## Conclusion

If we are using a Source Connector with ProtobufConverter, we should use the default configuration 
```properties
value.converter.auto.register.schemas=false
value.converter.use.latest.version=true
value.converter.latest.compatibility.strict=true
```
and ensure that the source messages have always the same schema, **including the order of the fields**.

Otherwise, the system becomes too fragile, we could get a lot of failures, or we could produce messages we won't be able to read.
Even with the default configuration, we should ensure that messages in the source don't change the order of the fields, as this will cause issues with Protobuf.









