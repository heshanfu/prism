import React, {Component} from 'react'
import {StyleSheet} from 'react-native'

import StyleRegistry from './StyleRegistry'
import Plugins from './Plugins'
import ExtendedPropertyPlugins from './ExtendedPropertyPlugins'
import propTypes from './PropTypes'

const STYLE = 'style'

const isObject = (o) => o && o.toString() === '[object Object]'
const isString = (o) => o && typeof(o) === 'string'
const isNumber = (o) => typeof(o) === 'number'
const isFunction = (fn) => (fn instanceof Function)
const isArray = Array.isArray
const util = {isObject, isFunction, isString, isArray, isNumber}

const compile = (decl) => {
  const sheet = {decl}
  const compiled = StyleSheet.create(sheet)
  return compiled.decl
}

const getStylePropertyName = (name) => {
  if (name !== STYLE && !/Style$/.test(name)) {
    name += 'Style'
  }
  return name
}

const Configuration = {
  plugins: null,
  defaultFontSize: 16,
  sizes: {
    'xx-small': 12,
    'x-small': 13,
    'small': 14,
    'medium': 16,
    'large': 18,
    'x-large': 22,
    'xx-large': 26
  }
}

const func = {
  fn: (o) => isFunction(o),
  type: 'function'
}

const fnOrObj = {
  fn: (o) => isFunction(o) || isObject(o),
  type: 'function or object'
}

const mapPluginTypeTests = {
  mapPropsToStyleObject: fnOrObj,
  mapPropsToStyleState: func,
  mapPropsToStyle: fnOrObj
}

const mapPluginNames = Object.keys(mapPluginTypeTests)

class Plugin  {
  constructor (name, func, propType = null, isGlobal = false) {
    this.name = name
    this.func = func
    this.propType = propType
    this.isGlobal = isGlobal
    if (propType) {
      this.propNames = Object.keys(propType)
    }
  }
}

const registerPlugins = (plugins) => {
  if (!Array.isArray(plugins)) {
    throw new Error('Prism: plugins must be an array')
  }
  return plugins.reduce((list, plugin) => {
    list = list.concat(registerPlugin(plugin))
    return list
  }, [])
}

const registerPlugin = (plugin) => {
  // Named plugin as array
  if (Array.isArray(plugin)) {
    const isGlobal = plugin.length >=2 &&
      typeof(plugin[0]) === 'string' && isFunction(plugin[1])
    const isProperty = plugin.length === 2 &&
      isFunction(plugin[0]) && isObject(plugin[1])

    if (isGlobal) {
      return new Plugin(plugin[0], plugin[1], plugin[2], true)
    }

    if (isProperty) {
      const keys = Object.keys(plugin[1])
      if (!keys.length) {
        throw new Error('Prism plugin definition with no propType keys')
      }
      return keys.map((propName) => {
        return new Plugin(propName, plugin[0], plugin[1][propName])
      })

      return new Plugin(name, plugin[1], plugin[2])
    }
  }
  throw new Error('Prism invalid plugin definition')
}

const getStyleSheet = (
  {
    context,
    props,
    sheets,
    definition,
    attrName,
    fullAttrName,
    plugins}) => {

  const style = props[fullAttrName]
  const {config, options, registry, namespace, Name, Type} = definition
  const {styleSheet, colors} = registry

  let childClassName
  let className = options.className || Name
  let componentClassName = namespace ? `${namespace}.${className}` : className

  // Passing style to nested child component
  if (attrName && attrName !== STYLE) {
    childClassName = attrName.charAt(0).toUpperCase() +
      attrName.substr(1)
    componentClassName += '.' + childClassName
  }

  const ns = {
    typeName: Name,
    className,
    componentClassName,
    childClassName,
    namespace
  }

  const defaultClassStyle = styleSheet[componentClassName] ?
    [styleSheet[componentClassName]] : []

  let {defaultStyles} = options

  if (Array.isArray(defaultStyles)) {
    defaultStyles = defaultStyles.concat(defaultClassStyle)
  }

  // Use default component class style
  if (!defaultStyles) {
    defaultStyles = defaultClassStyle
  }

  //let sheets = []

  // Add default styles
  sheets = sheets.concat(defaultStyles)

  // Process plugins
  const pluginOptions = {
    context,
    props,
    util,
    ns,
    config,
    definition,
    registry,
    styleSheet,
    options,
    colors
  }

  plugins.globals.forEach((plugin) => {
    pluginOptions.plugin = plugin
    const style = plugin.func(pluginOptions)
    if (style) {
      sheets = sheets.concat(style)
    }
  })

  const {keys, map} = plugins.property
  keys.forEach((propName) => {
    if ((props && props[propName] !== undefined)
        || (context && context[propName] !== undefined)) {
      const plugin = map[propName]
      pluginOptions.plugin = plugin
      pluginOptions.propName = propName
      pluginOptions.prop = props[propName]
      const style = plugin.func(pluginOptions)
      if (style) {
        sheets = sheets.concat(style)
      }
    }
  })

  // Add inline `style` property
  if (style) {
    sheets = sheets.concat(style)
  }

  if (options.flat) {
    return StyleSheet.flatten(sheets)
  }

  return sheets
}

// Register a stylable component type.
//
// Likely the registry has not been set yet.
const Prism = (Type, namespace = '') => {
  const Name = Type.name

  let styleOptions = Type.styleOptions
  if (styleOptions && !isFunction(styleOptions)) {
    throw new Error(
      `Prism styleOptions for ${Name} must be a function`)
  }

  // High order component wrapper
  const Wrapped = (Stylable, definition) => {
    class PrismComponent extends Component {

      constructor (props) {
        super(props)
        if (!definition.registry) {
          throw new Error(
            'Prism: no style registry configured, ' +
            'did you forget to call Prism.configure()?')
        }
        if (!definition.registry.styleSheet) {
          throw new Error(
            'Prism: no style sheet available, ' +
            'did you forget to call styleRegistry.addStyleSheet()?')
        }
        // Class level processing options
        const {options} = definition
        const state = {
          styleValues: {}
        }

        // Initialize empty styles, following the convention
        options.stylePropertyNames.forEach((name) => {
          name = getStylePropertyName(name)
          // Use initialStyles set by defaultProps
          state.styleValues[name] = definition.Type.initialStyles[name].slice()
        })
        this.state = state
      }

      setNativeProps (props) {
        const {stylable} = this.refs
        if (stylable.setNativeProps) {
          stylable.setNativeProps(props)
        }
      }

      processStylePlugins (props, testFunc = () => true) {
        const {registry, options, Type} = definition
        const {stylePropertyNames, mapPropsToStyleObject} = options
        const {globals, property} = options.plugins
        const {styleValues} = this.state
        const {context} = this
        let mutableStyleValues = Object.assign({}, styleValues)
        stylePropertyNames.forEach((attrName) => {
          if (testFunc({props, attrName})) {
            const fullAttrName = getStylePropertyName(attrName)
            const availableProperties = mapPropsToStyleObject[attrName].slice()
            const propertyStyleMap = {}
            const flatAvailableProperties =
              availableProperties.reduce((list, val) => {
                if (isObject(val)) {
                  const keys = Object.keys(val)
                  list.push(keys)
                  keys.forEach((key) => {
                    propertyStyleMap[key] = val[key]
                  })
                } else if (isString(val)) {
                  list.push(val)
                }
                return list
              }, [])

            // TODO: only run global plugins once!

            // Filter to properties available for this property attribute
            // Eg: style, labelStyle, imageStyle etc
            let propertyMap = {}
            let propertyPlugins = property.reduce((list, plugin) => {
              const ind = flatAvailableProperties.indexOf(plugin.name)
              if (~ind) {
                propertyMap[plugin.name] = plugin
                list.push(plugin.name)
                flatAvailableProperties.splice(ind, 1)
              }
              return list
            }, [])
            const plugins = {
              globals: globals,
              property: {
                keys: propertyPlugins,
                map: propertyMap
              }
            }

            let sheets = mutableStyleValues[fullAttrName]
            // Must wrap in if flat is in use
            if (sheets && !Array.isArray(sheets)) {
              sheets = [sheets]
            }

            const computedStyle = getStyleSheet(
              {
                context,
                props,
                sheets,
                definition,
                attrName,
                fullAttrName,
                plugins
              })

            // It's possible for a component to declare style
            // properties not mapped to a plugin, in this case
            // we pass the properties through verbatim
            // TODO: provide a default handler for these properties?
            // NOTE: currently this is the last computed style so overrides
            // NOTE: values in the target attribute eg: `labelStyle`
            if (flatAvailableProperties.length) {
              const verbatim = {}
              flatAvailableProperties.forEach((name) => {
                let styleProp = name
                if (propertyStyleMap[name]) {
                  styleProp = propertyStyleMap[name]
                }
                if (props[name] !== undefined) {
                  verbatim[styleProp] = props[name]
                }
              })
              computedStyle.push(verbatim)
            }

            mutableStyleValues[fullAttrName] = computedStyle
          }
        })
        this.setState({styleValues: mutableStyleValues})
      }

      static childContextTypes = {
        font: propTypes.fontPropType
      }

      static contextTypes = {
        font: propTypes.fontPropType
      }

      getChildContext () {
        const {options} = definition
        const {props} = this
        // NOTE: we only propagate to children
        // NOTE: until a component that supportsText
        // NOTE: is found
        if (!options.supportsText && props.font) {
          return {font: props.font}
        }
        return {}
      }

      // So that changes to style properties are
      // reflected in the stylable component
      componentWillReceiveProps (props) {
        this.processStylePlugins(props, ({attrName}) => {
          // TODO: proper invalidation
          return props[attrName] && this.props[attrName]
        })
      }

      componentWillMount () {
        this.processStylePlugins(this.props)
      }

      render () {
        return (
          <Stylable
            ref='stylable'
            {...this.props}
            {...this.state.styleValues} />
        )
      }
    }

    PrismComponent.propTypes = Stylable.propTypes
    PrismComponent.defaultProps = Stylable.defaultProps

    // Inject font contextType
    Stylable.contextTypes = Stylable.contextTypes || {}
    Stylable.childContextTypes = Stylable.childContextTypes || {}

    Stylable.contextTypes.font = propTypes.fontPropType
    Stylable.childContextTypes.font = propTypes.fontPropType

    // TODO: INHERIT ORIGINAL getChildContext
    if (Stylable.prototype.getChildContext) {
      Stylable.prototype._getChildContext = Stylable.prototype.getChildContext
    }
    Stylable.prototype.getChildContext = function () {
      let context = PrismComponent.prototype.getChildContext.call(this)
      // Call original getChildContext which wins over our
      // pre-defined child context so if there is a collision
      // I sure hope you know what you are doing
      if (this._getChildContext) {
        // NOTE: it's important we always have a context so guard
        // NOTE: against an implementation not returning an object
        const originalContext = this._getChildContext()
        context = Object.assign(context, isObject(originalContext) ? originalContext : {})
      }
      return context
    }

    // So we can easily see the underlying component name in errors
    PrismComponent.displayName = `Prism(${definition.Name})`

    return PrismComponent
  }

  const definition = {Type, Name, styleOptions, namespace}
  const NewType = Wrapped(Type, definition)
  definition.NewType = NewType

  if (!Prism.registry) {
    // Collect components before a registry is available,
    // these will be registered when Prism.configure() is called
    Prism.components.push(definition)
  } else {
    // Already configured so register directly
    registerComponent(Prism.registry, definition, Prism.config)
  }

  return NewType
}

const registerComponent = (registry, definition, config) => {
  const {Type, Name, styleOptions} = definition
  const {plugins} = config
  //definition.options = {}
  let options = {}
  if (styleOptions) {

    options = styleOptions({...registry, compile})
    const {defaultStyles} = options
    if (defaultStyles && !Array.isArray(defaultStyles)) {
      throw new Error(
        'Prism: default styles should be an array of objects')
    }
  }

  if (isObject(options.colors)) {
    registry.mergeColors(options.colors)
  }

  // Allow declaring mapPropsToStyle etc. as static on the Type
  mapPluginNames.forEach((name) => {
    if (options[name] !== undefined && Type[name] !== undefined) {
      throw new Error(
        `Prism you declared ${name} as static on ${Name} and also in styleOptions. ` +
        `This is not allowed, choose one of the other declaration style.`)
    }

    if (Type[name] !== undefined) {
      options[name] = Type[name]
    }

    const test = mapPluginTypeTests[name]
    // Got a declaration, validate it
    if (options[name] !== undefined && !test.fn(options[name])) {
      throw new Error(
        `Prism you declared ${name} as an invalid type, expected ${test.type} ` +
        `but got ${typeof(options[name])}`
      )
    }
  })

  const availablePropertyNames = config.plugins
    .filter((plugin) => plugin.propType)
    .map((plugin) => plugin.name)

  let {mapPropsToStyleObject} = options
  // User defined style property names
  if (mapPropsToStyleObject !== undefined) {
    if (util.isFunction(mapPropsToStyleObject)) {
      mapPropsToStyleObject = mapPropsToStyleObject(registry)
    }

    const assignedPropertyNames = Object.keys(mapPropsToStyleObject)
      .reduce((list, propName) => {
        list = list.concat(mapPropsToStyleObject[propName])
        return list
      }, [])

    if (mapPropsToStyleObject.style !== undefined) {
      throw new Error(
        `Prism do not configure mappings for "style" in mapPropsToStyleObject. ` +
        `It is an anti-pattern, use mapPropsToStyleProp or mapPropsToStyle instead.`)
    }

    // Configure handling for style property
    // when not explicitly specified
    mapPropsToStyleObject.style = availablePropertyNames
      .filter((propName) => !~assignedPropertyNames.indexOf(propName))
  }

  // Default style property support, all
  // names are mapped to the default style object
  if (!mapPropsToStyleObject) {
    mapPropsToStyleObject = {
      style: availablePropertyNames
    }
  }

  options.mapPropsToStyleObject = mapPropsToStyleObject
  options.stylePropertyNames = Object.keys(mapPropsToStyleObject)

  const globalPlugins = plugins
    .filter((plugin) => {
      return plugin.isGlobal
        && (options.hasOwnProperty(plugin.name) || plugin.name === 'colorNames')
    })
  const propertyPlugins = plugins.filter(
    (plugin) => !plugin.isGlobal)

  options.plugins = {
    property: propertyPlugins,
    globals: globalPlugins
  }

  definition.options = options

  // Merge config propTypes into the Stylable propTypes.
  //
  // On collision the underlying component propTypes win.
  const systemPropTypes = {}
  plugins.forEach((plugin) => {
    if (plugin.propType && !plugin.isGlobal) {
      systemPropTypes[plugin.name] = plugin.propType
    }
  })
  const propertyTypes = Object.assign(
    {}, systemPropTypes, Type.propTypes)
  Type.propTypes = propertyTypes

  // Automatic propTypes for style, labelStyle, imageStyle etc.
  Type.initialStyles = {}
  options.stylePropertyNames.forEach((name) => {
    name = getStylePropertyName(name)
    Type.propTypes[name] = propTypes.style

    // Configure initial styles per attribute
    // from defaultProps and cleanup so they
    // don't mess with our inheritance
    const list = []
    if (Type.defaultProps &&
      Type.defaultProps[name]) {
      list.push(Type.defaultProps[name])
      delete Type.defaultProps[name]
    }
    Type.initialStyles[name] = list
  })

  //console.log(Object.keys(Type.propTypes))

  // TODO: support multiple registries
  // TODO: merge if we have an existing registry?
  definition.config = config
  definition.registry = registry
}

Prism.components = []
Prism.configure = (registry, config = {}) => {
  if (!(registry instanceof StyleRegistry)) {
    throw new Error('Prism expects a StyleRegistry for configure()')
  }

  let systemPlugins = Plugins
  if (config.extendedProperties) {
    systemPlugins = systemPlugins.concat(ExtendedPropertyPlugins)
  }

  let plugins = Array.isArray(config.plugins) ? config.plugins : systemPlugins

  // Register the plugins
  plugins = registerPlugins(plugins)

  if (Array.isArray(config.additionalPlugins)) {
    plugins = plugins.concat(
      registerPlugins(config.additionalPlugins))
  }

  // Process flags that disable plugins
  if (Array.isArray(config.disabledPlugins)) {
    plugins = plugins.filter((plugin) => {
      return !~config.disabledPlugins.indexOf(plugin.name)
    })
  }

  Prism.config = Object.assign({}, Configuration, config)

  if (config.debug) {
    console.log(`Prism configured with ${plugins.length} plugins`)
    plugins.forEach((plugin) => {
      console.log(`Prism using plugin "${plugin.name}" (global: ${plugin.isGlobal})`)
    })
  }

  // Ensure we use the computed plugins
  Prism.config.plugins = plugins

  if (!Array.isArray(Prism.config.plugins)) {
    throw new Error('Prism: array expected for plugins list')
  }

  // Components exported before the registry was configured
  Prism.components.forEach((definition) => {
    registerComponent(registry, definition, Prism.config)
  })

  Prism.registry = registry
}

Prism.propTypes = propTypes

export {StyleRegistry, Prism}
