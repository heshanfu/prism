import util from './util'
const {isObject} = util

class Rule {
  constructor (fn, styleName, propStyleName) {
    // Handler called when the property is encountered
    this.fn = fn
    // Name of the property in a style declaration
    this.styleName = styleName
    // Name of the property on a component, assumed to be
    this.propStyleName = propStyleName || styleName
  }
}

class Processor {

  hasPreProcessors = false

  map = {
    // Preprocessors keyed by styleName
    styles: {},
    // Preprocessors keyed by propStyleName
    props: {}
  }

  config = null

  collate (config) {
    const {processors} = config
    console.log('collating with :' + processors.length)
    if (!processors || !processors.length) {
      return
    }
    processors.forEach((proc) => {
      if (proc.styleName) {
        this.map.styles[proc.styleName] = proc
      }
      if (proc.propStyleName) {
        this.map.props[proc.propStyleName] = proc
      }

      this.hasPreProcessors = true
    })

    this.config = config
  }

  get (propName, isStyle) {
    const {map} = this
    return isStyle ? map.styles[propName] : map.props[propName]
  }

  process (target, isStyle) {
    const {config} = this
    const {processors} = config
    if (!this.hasPreProcessors) {
      return
    }
    const {registry} = config
    let propName, propValue, proc
    for (propName in target) {
      propValue = target[propName]
      proc = this.get(propName, isStyle)
      if (proc) {
        console.log('Found preprocessor for: ' + propName)
        console.log('Found preprocessor for: ' + propValue)
        const write = (newValue, newPropName) => {
          newPropName = newPropName || propName
          target[newPropName] = newValue
        }
        const procOptions = {
          propName,
          propValue,
          write,
          ...registry
        }
        proc.fn(procOptions)
        //if (res !== undefined) {
          //console.log('rewriting result: ' + res)
          //target[propName] = res
        //}
      }
      // Recurse for initial style declarations
      if (isObject(propValue)) {
        this.process(propValue, isStyle)
      }
    }
  }
}

// Singleton
const processor = new Processor()

export {processor, Rule}
