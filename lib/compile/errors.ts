import {KeywordErrorContext, KeywordErrorDefinition} from "../types"
import CodeGen, {_, str, Code, Name} from "./codegen"
import N from "./names"

export const keywordError: KeywordErrorDefinition = {
  message: ({keyword}) => str`should pass ${keyword} keyword validation`,
  params: ({keyword}) => _`{keyword: ${keyword}}`, // TODO possibly remove it as keyword is reported in the object
}

export function reportError(
  cxt: KeywordErrorContext,
  error: KeywordErrorDefinition,
  overrideAllErrors?: boolean
): void {
  const {gen, compositeRule, allErrors, async} = cxt.it
  const errObj = errorObjectCode(cxt, error)
  if (overrideAllErrors ?? (compositeRule || allErrors)) {
    addError(gen, errObj)
  } else {
    returnErrors(gen, async, _`[${errObj}]`)
  }
}

export function reportExtraError(cxt: KeywordErrorContext, error: KeywordErrorDefinition): void {
  const {gen, compositeRule, allErrors, async} = cxt.it
  const errObj = errorObjectCode(cxt, error)
  addError(gen, errObj)
  if (!(compositeRule || allErrors)) {
    returnErrors(gen, async, N.vErrors)
  }
}

export function resetErrorsCount(gen: CodeGen, errsCount: Name): void {
  gen.assign(N.errors, errsCount)
  gen.if(_`${N.vErrors} !== null`, () =>
    gen.if(errsCount, _`${N.vErrors}.length = ${errsCount}`, _`${N.vErrors} = null`)
  )
}

export function extendErrors({
  gen,
  keyword,
  schemaValue,
  data,
  errsCount,
  it,
}: KeywordErrorContext): void {
  if (errsCount === undefined) throw new Error("ajv implementation error")
  const err = gen.name("err")
  gen.for(_`let i=${errsCount}; i<${N.errors}; i++`, () => {
    gen.const(err, _`${N.vErrors}[i]`)
    gen.if(
      _`${err}.dataPath === undefined`,
      _`${err}.dataPath = (${N.dataPath} || '') + ${it.errorPath}`
    )
    gen.code(_`${err}.schemaPath = ${str`${it.errSchemaPath}/${keyword}`};`)
    if (it.opts.verbose) {
      gen.code(
        _`${err}.schema = ${schemaValue};
        ${err}.data = ${data};`
      )
    }
  })
}

function addError(gen: CodeGen, errObj: Code): void {
  const err = gen.const("err", errObj)
  gen.if(_`${N.vErrors} === null`, _`${N.vErrors} = [${err}]`, _`${N.vErrors}.push(${err})`)
  gen.code(_`${N.errors}++;`)
}

function returnErrors(gen: CodeGen, async: boolean, errs: Code): void {
  if (async) {
    gen.code(_`throw new ValidationError(${errs})`)
  } else {
    gen.assign(_`${N.validate}.errors`, errs)
    gen.return(false)
  }
}

function errorObjectCode(cxt: KeywordErrorContext, error: KeywordErrorDefinition): Code {
  const {
    keyword,
    data,
    schemaValue,
    it: {createErrors, topSchemaRef, schemaPath, errorPath, errSchemaPath, propertyName, opts},
  } = cxt
  if (createErrors === false) return _`{}`
  if (!error) throw new Error('keyword definition must have "error" property')
  const {params, message} = error
  // TODO trim whitespace
  const out = _`{
    keyword: ${keyword},
    dataPath: (${N.dataPath} || "") + ${errorPath},
    schemaPath: ${str`${errSchemaPath}/${keyword}`},
    params: ${params ? params(cxt) : _`{}`}`
  if (propertyName) out.append(_`, propertyName: ${propertyName}`)
  if (opts.messages !== false) {
    out.append(_`, message: ${typeof message == "string" ? message : message(cxt)}`)
  }
  if (opts.verbose) {
    out.append(
      _`, schema: ${schemaValue}, parentSchema: ${topSchemaRef}${schemaPath}, data: ${data}`
    )
  }
  out.append(_`}`)
  return out
}
