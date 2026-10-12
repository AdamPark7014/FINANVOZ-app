@file:Suppress("unused")

package expo.modules.kotlin.records

interface Record

@Target(AnnotationTarget.FIELD, AnnotationTarget.PROPERTY)
annotation class Field(val key: String = "")
