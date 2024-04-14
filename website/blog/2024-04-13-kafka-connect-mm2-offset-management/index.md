---
slug: kafka-connect-mm2-offset-management
title: Kafka Connect, MM2, and Offset Management
authors: javier
tags: [Scala, Java, Kafka, Kafka-Connect, MM2, offsets, MSK, Mirror-Maker2]
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Kafka Connect, MM2, and Offset Management

This post is about Kafka Connect, Mirror Maker 2, how they manage offsets, and how to deal with them.

## Kafka Offsets

When a consumer starts consuming messages from Kafka, it will probably use a `consumer-group` and Kafka will store the 
offset of the last message consumed by that consumer-group. This offset is stored in a Kafka topic called `__consumer_offsets`.

By doing this, when the consumer restarts, it can start consuming messages from the last offset it consumed.

There are tools that allow us to manage these offsets, like the binary files provided by Kafka, and in any case, 
the consumer can always decide which offsets to consume from. This means that the consumer can set the offset to the beginning, 
the end, or any other offset. A lot of tools allow even to search offsets based on timestamps.

### Monitoring offset lag

The `consumer-offset-lag` is a metric provided by Kafka, based on the difference between the last offset consumed by the consumer 
and the last offset produced by the producer. Most of the monitoring tools will have this value, like DataDog, 
and it is very useful to know if the consumer is lagging, meaning that it is not consuming messages as fast as they are produced, or it is down.

But ****Mirror Maker 2 (MM2) can not be monitored through this metric****, see below.

## Kafka Connect Offsets
:::note
When we talk about Kafka Connect, we are talking about the distributed version of Kafka Connect, not the standalone version.
:::

Kafka Connect manage offsets in their own way. When a consumer is started by Kafka Connect, it will store the offsets in a Kafka topic 
called `connect-offsets` by default, although it can be configured through the `offset.storage.topic` property.

:::tip
When a connector is created in Kafka Connect, it will track the offsets in its own topic, but it also will use a regular "consumer-group" so the offsets will be also tracked in `__consumer_offsets`. 
This also means that we can monitor Kafka Connect sinks through the `consumer-offset-lag` metric.
:::


## Mirror Maker 2 (MM2) Offsets

Mirror Maker 2 is a tool provided by Kafka to replicate messages from one Kafka cluster to another, it is meant to be used for a complete replication between clusters, 
but it can be used to copy only some topics.

:::note
MM2 can be run in different ways, but here we are talking about the `Kafka Connect` way, where MM2 is run as a Kafka Connect connector.
:::

If we think about MM2 and the data it needs to consume and produce, we can have doubts about how offsets can be managed. 
To start with, it needs to read in one cluster and write on another, so, how does it manage the offsets?

By default, MM2 will create a topic called `mm2-offset-syncs.<cluster-alias>.internal` and as far asI know, it can not be renamed.

:::tip
While working with MM2, it is recommended to install the connectors in the "target" cluster, so the "source" cluster will be the external one.
:::

By default, MM2 will create the aforementioned topic in the "source" cluster, and it will store the offsets of the last message consumed and produced. 
But as we can see, the "source" cluster is "external" to where the Kafka Connect is installed, and that might cause some issues 
in cases where the "source" cluster is not managed by us. For example, we might not have write or create access, and we can not create the topic.

The destination of `mm2-offset-syncs.<cluster-alias>.internal` can be defined by the [`offset-syncs.topic.location` property](https://kafka.apache.org/documentation/#mirror_source_offset-syncs.topic.location) which accepts `source` (default) and `target`.

:::note
When a Consumer is created by MM2, which is a Kafka Connect connector, it will store the offsets both in `mm2-offset-syncs.<cluster-alias>.internal` and in `connect-offsets`.
This is very important if we want to manipulate offsets
:::

:::warning
MM2 consumers do not use a `group.id`, they do not use any Kafka consumer group and their consumed offset won't be stored in `__consumer_offsets`. 
This also means that we can not monitor MM2 through the `consumer-offset-lag` metric.
:::

## Mixing Kafka Connect and MM2

If we look at the offsets stored both by Kafka Connect and MM2 in their topics, we can see the following:

### Kafka Connect topic

If we look at the `connect-offsets` topic, we can see that the offsets are stored in JSON format, with the following structure:
- `key` is a structure that contains the connector name, the partition, the topic, and the cluster.
```json
[
	"my-connector-name",
	{
		"cluster": "my-source-cluster-alias",
		"partition": 3,
		"topic": "my-example-topic"
	}
]
```
- And the `value` is a JSON with the offset:
```json
{
    "offset": 1234
}
```
:::note
No matter where we store the offsets (source or target), Kafka Connect will show the "source cluster alias" as this is where the Kafka consumer is created.
:::

### MM2 topic

If we look at the `mm2-offset-syncs.<cluster-alias>.internal` topic, we can see KC uses its own format to store the offsets:
- `key` is the connector name, but it has a few extra bytes, which represents some structure defined inside the code
- `value` is just an Int64, which represents the offset

Managing offsets is not really recommended as we could mess up the connectors, but it is possible to do it.


## Hot to reset offsets in Mirror Maker 2

If we need to reset the offsets in MM2, we might think that deleting the topic `mm2-offset-syncs.<cluster-alias>.internal` will do the trick, 
but it won't, as offsets are also stored in Kafka Connect's topic. So, we need to reset the offsets in both topics.


There is a lot of misinformation about how to reset the offsets in Kafka Connect, their docs are not very clear about it, and Kafka Connect has been lacking tools to work with it. 
Typically, removing the connector and creating it with a different name will do the trick, but we might want to keep the same name.


### Manual edit of offsets

We can manually produce a message in the `connect-offsets` topic to reset offsets, and the right way of doing it is to send a `tombstone`. 
We can check the messages we have right now, identify the connector we want and send the same Key with `null` value.

:::note
To reset offsets completely we do not specify `offset: 0`, we send a null value
:::

### REST API to reset offsets
Starting from [Kafka 3.6.0](https://archive.apache.org/dist/kafka/3.6.0/RELEASE_NOTES.html), Kafka Connect has a REST API to manage connectors, and it is possible to reset offsets through it.
The docs about it are defined in the [KPI-875](https://cwiki.apache.org/confluence/display/KAFKA/KIP-875%3A+First-class+offsets+support+in+Kafka+Connect#KIP875:FirstclassoffsetssupportinKafkaConnect-PublicInterfaces), but they are still not present in the official docs.
If you are using Confluent, starting from [Confluent's 7.6.0 version](https://docs.confluent.io/platform/current/release-notes/index.html) Kafka 3.6.0 is included.

If we use this version, we can simply do a few curls to reset offsets. First we need to stop the connector and then reset the offsets.

```bash
curl -X PUT http://localhost:8083/connectors/my-connector-name/offsets/stop
curl -X DELETE http://localhost:8083/connectors/my-connector-name/offsets
```

We can also know the status of the offsets:
```bash
curl -X GET http://localhost:8083/connectors/my-connector-name/offsets | jq
```

## TL;DR
To reset offsets in MM2, you need to:
- Stop, pause or remove the connectors
- Delete or truncate the topic `mm2-offset-syncs.<cluster-alias>.internal` 
- Reset the offsets in the `connect-offsets` topic, either manually or through the REST API for the desired connector
- Start the connectors again

:::warning
Deleting the topic `mm2-offset-syncs.<cluster-alias>.internal` will not reset the offsets for other connectors you have configured in MM2 
as they fall back to the `connect-offsets` topic, but be careful and do this at your own risk, things might change in the future and this could become false.
:::





