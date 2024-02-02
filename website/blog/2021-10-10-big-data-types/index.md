---
slug: big-data-types-library
title: Big Data Types Library
authors: javier
tags: [Scala, Spark, Big-query, Cassandra, Circe, type-class, type-safe, type-derivation, type-level-programming]
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Scala Big Data Types Library

Big Data Types is a library that can safely convert types between different Big Data systems.

## The power of the library

The library implements a few abstract types that can hold any kind of structure, and using type-class derivations,
it can convert between multiple types without having any code relating them. In other words, there is no need to implement a transformation between type A to type B, the library will do it for you.

As an example, let's say we have a generic type called `Generic`. Now we want to convert from type `A` to type `B`. 
If we implement the conversion from `A` to `Generic` and the conversion from `Generic` to `B`, automatically we can convert from `A` to `B` although there is no a single line of code mixing `A` and `B`.


We can also do the opposite, we can convert from `B` to `A` by implementing the conversion from `B` to `Generic` and the conversion from `Generic` to `A`. Now we can convert between `A` and `B` as we wish.


Now comes the good part of this. If we introduce a new type `C` and we want to have conversions, we would need to convert from `A` to `C`, and from `B` to `C` and the opposite **(4 new implementations)**. 
If now we introduce `D`, we would need to implement the conversion from `A` to `D`, from `B` to `D` and from `C` to `D` and the opposite **(6 new implementations)**. This is not scalable, and it is not maintainable. 


Having this `Generic` type means that when we introduce `C`, we only need to implement the conversion from `C` to `Generic` and from `Generic` to `C`, without worrying at all about other implementations or types. 
Moreover, is likely that the conversion will be very similar to others, so we can reuse some the code.

:::tip
It is important to know that one of these types is the Scala types themselves. So if we want to convert from `Scala types` (like `case classes`) to another type, we only need to implement `Generic -> newType`
:::

## How the library works


### Modules
As mentioned, the library has multiple modules, each one of them represents a different system with its own types. Each module implements the conversion from and to `Generic`.

For now, the modules are `core` (for Scala types and common code), `BigQuery`, `Cassandra`, `Circe` and `Spark`.

In order to use the library, only the modules that are needed should be imported. For example, if we want to convert from `Scala types` to `BigQuery` types, we only need to `BigQuery` module. (`Core` module is always included as dependency)
If we want to convert from `Spark` to `BigQuery` we need to import both `Spark` and `BigQuery` modules. 

### Generic type

The `Generic` type is called `SqlType` and it's implemented as [sealed trait](https://github.com/data-tools/big-data-types/blob/main/core/src/main/scala_2/org/datatools/bigdatatypes/basictypes/SqlType.scala) that can hold any kind of structure. 
In Scala 3, this type is implemented as an [enum](https://github.com/data-tools/big-data-types/blob/main/core/src/main/scala_3/org/datatools/bigdatatypes/basictypes/SqlType.scala) but both represents the same.

#### Repeated values
Usually, there are two ways of implement a repeated value like an Array. Some systems use a type like `Array` or `List` 
and others flag a basic type with `repeated`. The implementation of this `SqlType` is using the latter, 
so any basic type can have a `mode` that can be `Required`, `Nullable` or `Repeated`. This is closer to the `BigQuery` implementation.

:::note
This implementation does not allow for `Nullable` and `Repeated` at the same time, but a `Repeated` type can have 0 elements.
:::

#### Nested values
The `SqlStruct` can hold a list of records, including other `SqlStruct`, meaning that we can have nested structures.

## Type-class derivation

Type-classes are a way of implementing "ad-hoc polymorphism". This means that we can implement a behaviour for a type without having to modify the type itself.
In Scala, we achieve this through implicits.

The interesting part of type-classes for this library is that we can derive a type-class for a type without having to implement it.

For example, we can create a simple type-class:

```scala
trait MyTypeClass[A] {
  def doSomething(a: A): String
}
```
:::tip
A type-class is always a `trait` with a generic type.
:::
The, we can implement our type-class for an `Int` type:

```scala
implicit val myTypeClassForInt: MyTypeClass[Int] = new MyTypeClass[Int] {
  override def doSomething(a: Int): String = "This is my int" + a.toString
}
```
:::tip
Scala 2.13 has a simplified syntax for this when there is only one method in the trait:
```scala
implicit val myTypeClassForInt: MyTypeClass[Int] = (a: Int) => "This is my int" + a.toString
```
:::
We can do similar for other types:

```scala
implicit val myTypeClassForString: MyTypeClass[String] = new MyTypeClass[String] {
  override def doSomething(a: String): String = "This is my String" + a
}
```

Now, if we want to have a `List[Int]` or a `List[String]`, and use our type-class, we need to implement both `List[Int]` and `List[String]`.
**But**, if we implement the type-class for `List[A]` where `A` is any type, the compiler can derive the implementation for `List[Int]` and `List[String]` automatically, and for any other type already implemented.

```scala
implicit def myTypeClassForList[A](implicit myTypeClassForA: MyTypeClass[A]): MyTypeClass[List[A]] = new MyTypeClass[List[A]] {
  override def doSomething(a: List[A]): String = a.map(myTypeClassForA.doSomething).mkString(",")
}
```

Similarly, if we want to have a `case class` like:
```scala
case class MyClass(a: Int, b: String)
```
We would need to implement the type-class for `MyClass`. But, if we implement the type-class for a generic `Product` type, the compiler can derive the implementation for `MyClass` automatically, and for any other `case class` that has types already implemented.

:::note
Implementing the conversion for a `Product` type is more complex than implementing it for a `List` type, and usually [Shapeless](https://github.com/milessabin/shapeless) is the library we use to do this in Scala 2.

In Scala 3, the language already allow us to derive the type-class for a `Product` type, so we don't need to use Shapeless.

In [big-data-types](https://github.com/data-tools/big-data-types) we have the implementation for all basic types, including iterables and `Product` types [here for Scala 2](https://github.com/data-tools/big-data-types/blob/main/core/src/main/scala_2/org/datatools/bigdatatypes/conversions/SqlTypeConversion.scala) 
and [here for Scala 3](https://github.com/data-tools/big-data-types/blob/main/core/src/main/scala_3/org/datatools/bigdatatypes/conversions/SqlTypeConversion.scala).
:::

## Implementing a new type

In order to implement a new type, we need to implement the conversion from and to `Generic` type. There is a complete guide, step by step, with examples, in the [official documentation](https://data-tools.github.io/big-data-types/docs/Contributing/CreateNewType)


A quick example, let's say we want to implement a new type called `MyType`. We need to implement the conversion `MyType -> Generic` and `Generic -> MyType`.
:::tip
Both conversions are not strictly needed, if we only need to use `Scala -> MyType` we only need to implement `Generic -> MyType`
because the library already has the conversion `Scala -> Generic`. The same happens with other types, like `BigQuery -> MyType` will also be ready automatically.
:::

To do that, we need a type-class that works with our type. This will be different depending on the type we want to implement.
For example:
```scala
trait GenericToMyType[A] {
  def getType: MyTypeObject
}
```
Maybe our type works with a List at the top level, like Spark does, so instead, we will do:
```scala
trait GenericToMyType[A] {
  def getType: List[MyTypeObject]
}
```
:::tip
`getType` can be renamed to anything meaningful, like `toMyType` or `myTypeSchema`
:::

And we need to implement this type-class for all the (Generic) `SqlType` types:
<Tabs>
    <TabItem value="Scala2" label="Scala 2" default>
        ```scala
        implicit val genericToMyTypeForInt: GenericToMyType[SqlInt] = new GenericToMyType[SqlInt] {
          override def getType: MyTypeObject = MyIntType
        }
        ```
    </TabItem>
    <TabItem value="Scala3" label="Scala 3" default>
        ```scala
        given GenericToMyType[SqlInt] = new GenericToMyType[SqlInt] {
            override def getType: MyTypeObject = MyIntType
        }
        ```
    </TabItem>
</Tabs>

## Using conversions

The defined type-classes allow you to convert `MyType -> Generic` by doing this:
```scala
val int: SqlInt = SqlTypeConversion[MyIntType].getType
```
And `Generic -> MyType` by doing this:
```scala
val int: MyIntType = SqlTypeToBigQuery[SqlInt].getType
```

This can work well when we work this `case classes` and we don't have an instance of them. For example, a `case class` definition can be converted into a `BigQuery` Schema, ready to be used for table creation.

But, sometimes, our types work with instances rather than definitions, and we need to use them to convert to other types. 

There is another type-class on all implemented types that allows to work with instances. In general, this type-class can be implemented using code from the other, but this one expects an argument of the type we want to convert to.
```scala
trait SqlInstanceToMyType[A] {
  def myTypeSchema(value: A): MyTypeObject
}
```

Implementing this type class allows to use the conversion like this:
```scala
val mySchema: MyTypeObject = SqlInstanceToMyType.myTypeSchema(theOtherType)
```

But these syntaxis are not very friendly, and we can use extension methods to make it more readable.

## Extension methods
Extension methods in Scala 2 are done through implicit classes and allow us to create new methods for existing types.

In the library, we implement extension methods for `Generic -> SpecificType` and the interesting part, again, is that we don't need to implement `A -> B` directly, the compiler can derive it for us.

<Tabs>
    <TabItem value="Scala2" label="Scala 2" default>
        ```scala
          implicit class InstanceSyntax[A: SqlInstanceToMyType](value: A) {
            def asMyType: MyTypeObject = SqlInstanceToMyType[A].myTypeSchema(value)
          }
        ```
    </TabItem>
    <TabItem value="Scala3" label="Scala 3" default>
        ```scala
          extension[A: SqlInstanceToMyType](value: A) {
            def asMyType: MyTypeObject = SqlInstanceToMyType[A].myTypeSchema(value)
          }
        ```
    </TabItem>
</Tabs>


and suddenly, we can use the conversion like this:
```scala
val mySchema: MyTypeObject = theOtherType.asMyType
```

And this is a syntax that can be easier to use. For example, if we work with Spark and BigQuery, we can do the following:
```scala
val sparkDf: DataFrame = ???
val bigQuerySchema = sparkDf.schema.asBigQuery
```


## More types to come

The library has only a few types implemented (BigQuery, Spark, Cassandra and Circe) but implementing a new type is fairly easy and it gets automatically methods that can be used to convert it into any other type already implemented. 
As this grows, the number of conversions grows exponentially, and the library becomes more powerful.

Some types that could be potentially implemented:
- Avro
- Parquet
- Athena (AWS)
- Redshift (AWS)
- Snowflake
- RDS (relational databases)
- Protobuf
- ElasticSearch templates
- ...

Some types could have some restrictions, but they could be implemented in a different way, for example, 
a type conversion could be implemented as a `String` conversion, being the string a "Create table" statement for a specific database 
and automatically any other type could be printed as a "Create table" statement.
