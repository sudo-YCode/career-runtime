package dev.yatin.migrator

const val MAX_ATTEMPTS = 4

data class BuildTarget(val label: String, val buildFile: String)
data class BuildResult(val ok: Boolean, val errors: List<String>)

sealed interface Outcome {
    data class Green(val gradle: String, val attempts: Int) : Outcome
    data class Red(val lastDraft: String, val errors: List<String>) : Outcome
}

fun interface Rules { fun convert(target: BuildTarget): String }
fun interface Gradle { suspend fun build(script: String): BuildResult }
fun interface Llm { suspend fun fix(script: String, errors: List<String>): String }

/** Rules first; the model only repairs what the compiler rejects. */
suspend fun migrate(target: BuildTarget, rules: Rules, gradle: Gradle, llm: Llm): Outcome {
    var draft = rules.convert(target)
    var errors = emptyList<String>()
    for (attempt in 1..MAX_ATTEMPTS) {
        val result = gradle.build(draft)      // suspension point: L1
        if (result.ok) return Outcome.Green(draft, attempt)
        errors = result.errors
        draft = llm.fix(draft, errors)        // suspension point: L2
    }
    return Outcome.Red(draft, errors)
}
