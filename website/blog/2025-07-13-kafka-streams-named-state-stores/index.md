---
slug: kafka-streams-state-stores
title: Kafka Streams - Why you should use named state stores
authors: javier
tags: [kafka-streams, kafka, state-store]
---

# Kafka Streams

Kafka Streams is a client library for building applications and microservices where the input and output data are stored in Kafka clusters. 
It combines the simplicity of writing and deploying standard Java and Scala applications on the client side with the benefits of Kafka's server-side cluster technology.

Unlike other stream processing frameworks, Kafka Streams is not a separate processing cluster but a library that runs within your application. 
This means you don't need to set up and manage a separate cluster - your application becomes the stream processing engine.

Kafka Streams provides high-level DSL (Domain Specific Language) operations like `map`, `filter`, `join`, and `aggregate`, 
as well as low-level Processor API for more complex use cases. It handles fault tolerance, scalability, and exactly-once processing semantics automatically.

## State Stores

State stores are a fundamental concept in Kafka Streams that allow you to maintain local state within your stream processing application. 
They are essentially key-value stores that are backed by Kafka topics for durability and fault tolerance.

By default, you don't need to think much about them, Kafka Streams automatically creates and manages state stores for you when you use operations like `groupBy`, `aggregate`, or `join`.

State stores are automatically managed by Kafka Streams, including:
- Persistence to local disk (RocksDB by default)
- Backup to Kafka topics (changelog topics)
- Restoration during application restarts
- Rebalancing when scaling up/down

As an example, a common scenario is when you want to performa a join between two streams. One way of doing it is to use a `KTable`, which is a representation of a stream as a table. 
When you create a `KTable` from a topic, Kafka Streams automatically creates a state store to maintain the current state of that table. Then, you can join a `KStream` with a `KTable`.

When joining a `KStream` with a `KTable`, Kafka Streams will perform the join for each record in the `KStream` against the current state of the `KTable`.
:::warning
This means that if the `KTable` is not up to date, or if it missing data for any reason, the join might not produce the expected results.
:::

## Internal Topics

When you use stateful operations in Kafka Streams, the framework automatically creates internal topics in Kafka to support fault tolerance and state management. 
These topics are not meant to be consumed directly by other applications.

The main types of internal topics are:

### Changelog Topics
These topics store the complete state of your state stores. Every change to a state store is logged to its corresponding changelog topic. 
The naming pattern is:
```
<application.id>-<store-name>-changelog
```

### Repartition Topics
Created when data needs to be repartitioned for operations like joins or aggregations. The naming pattern is:
```
<application.id>-<operation>-repartition
```

:::warning
In these cases, if you don't explicitly name your state stores, Kafka Streams will generate automatic names. The problem? Kafka Streams may change the name of your state stores between versions, leading to missing data.

As an example, if you re-deploy an application performing a `KTable` <-> `KStream` join, and the `-changelog` topic is renamed, you will lose the past data in your `KTable` and your joins won't match as expected.
:::

### Code Examples

Let's take a common code example. If you do these operations in Kafka Streams:
- Create a `KStream` from a topic
- Do a stateless operation like `map` or `filter`
- Create a `KTable` from this `KStream`
- Perform a left join with another `KStream`

In code, it will look like this:

```scala
    val sourceStream: KStream[String, A] = builder.stream[String, A]("test-topic")
    val mappedStream: KStream[String, B] = sourceStream.map { (key, value) =>
      // assume some transformation logic
      val transformedValue = ???
      (key, transformedValue)
    }
    // .toTable will create a state store
    val kTable: KTable[String, String] = mappedStream.toTable
    val secondStream: KStream[String, C] = builder.stream[String, B]("test-topic-2")
    val joinedStream: KStream[String, D] = secondStream.leftJoin(kTable) { (streamValue, tableValue) =>
      // Join logic
      ???
    }
```

When this code runs:
1. Kafka Streams creates a state store to maintain the current state of the topic
2. A changelog topic `my-application-KSTREAM-TOTABLE-STATE-STORE-0000000007-changelog` is created
3. Every update to the KTable updates both the local state store and the changelog topic
4. If the application restarts, the state store is rebuilt from the changelog topic


But now, what happens if we modify the code? For example, the `map` operation? 
Kafka Streams will think it's a new `KTable` and it will create a new state store with a new name, like this:

`my-application-KSTREAM-TOTABLE-STATE-STORE-0000000042-changelog`.

When the application restarts, it will rebuild the `KTable` in memory using the data from the new changelog topic, 
but the old data will be lost, as it was stored in the previous changelog topic.
Practically speaking, we have lost all the previous data in the `KTable`. 
Now, new records in the `KStream` that try to find a match on data processed before our re-deployment will not find it, leading to missing results.


## Naming State Stores

Properly naming your state stores is crucial for maintainability and understanding your Kafka Streams topology. 
When you don't explicitly name your state stores, Kafka Streams generates automatic names that can be hard to understand, 
but more important, they can lose data during changes between versions.

You can (and you should) provide explicit names for your state stores using the `Materialized` class.

The above example can be modified to use explicit names for the state store:
```scala
    val kTable: KTable[String, String] = mappedStream.toTable(
      Materialized.as("mapped-stream-table")
    )
```
Full example: 
```scala
    val sourceStream: KStream[String, A] = builder.stream[String, A]("test-topic")
    val mappedStream: KStream[String, String] = sourceStream.map { (key, value) =>
      // assume some transformation logic
      val transformedValue = ???
      (key, transformedValue)
    }
    // .toTable will create a state store, now with an explicit name
    val kTable: KTable[String, String] = mappedStream.toTable(
      Materialized.as[String, String]("mapped-stream-table")
    )
    val secondStream: KStream[String, B] = builder.stream[String, B]("test-topic-2")
    val joinedStream: KStream[String, C] = secondStream.leftJoin(kTable) { (streamValue, tableValue) =>
      // Join logic
      ???
    }
```

:::warning
Note that the `Materialized` class has other methods, like `Materialized.with`, which allow you to specify some configuration, but not the name of the state store.
:::

:::warning
Also, note that the class `Named`, which you can use like `Named.as("my-name")`, is not the same as `Materialized.as("my-name")`,
`Named` gives a name to the operation, not to the state store. This might work for other topics like `*-repartition` topics, but it does not affect state stores.
:::

More options can be set on a State Store, a bigger example would be:
```scala
stream.toTable(
        Named.as(s"TABLE-${tableName}"),
        Materialized
          .as[K, V, ByteArrayKeyValueStore](s"TABLE-${tableName}")
          .withKeySerde(keySerde)
          .withValueSerde(valueSerde)
          .withStoreType(storeType)
      )
```


The same happens with other operations, like `aggregate`.

Without explicit naming, Kafka Streams generates names like:
```
KSTREAM-AGGREGATE-STATE-STORE-0000000003
```

The corresponding changelog topic would be:
```
my-app-KSTREAM-AGGREGATE-STATE-STORE-0000000003-changelog
```

Which after a re-deployment, if the state store name changes, will lead to wrong aggregation results.

::::tip
Use descriptive names that clearly indicate what the state store contains. 
This makes debugging, monitoring, and maintenance much easier. For example, add your operation to the name, like `TOTABLE`, 
or `AGGREGATE` plus any additional context that helps you understand the purpose of the state store.
::::

### Benefits of Named State Stores

We could list several benefits, but among them, the most important one is: **You won't lose data silently**.


## TL;DR

- If you do not give explicit names to your state stores, eventually you will silently lose data.

If you think this might be already happening to you, check all the topics named like `*-changelog` in your Kafka cluster, 
and check if any of them has outdated data, it could potentially indicate that a state store was renamed at some point, 
leaving a `*-changelog` topic unused, and another one with less data than expected.
