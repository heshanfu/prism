import PropTypes from 'prop-types'
import propTypes from './PropTypes'

import {StyleSheet} from 'react-native'
import util from './util'

const {isObject, isString} = util

const mapPropsToStyleState = ({props, options, registry, util, ns, attrName}) => {
  const {mapPropsToStyleState} = options
  const {styleSheet} = registry
  let stateStyle = mapPropsToStyleState({...registry, props})
  const isStyle = attrName
  console.log('mapping props to state style: ' + attrName)
  const sheets = []
  if (stateStyle) {
    let stateStyleDeclName
    let stateStyleSheet = stateStyle
    if (util.isString(stateStyle)) {
      if (isStyle) {
        // This gives us the top-level component
        stateStyleDeclName = ns.getStateClassName(stateStyle)
        stateStyleSheet = styleSheet[stateStyleDeclName]
      } else{
        stateStyleDeclName = ns.getChildStateClassName(attrName, stateStyle)
        stateStyleSheet = styleSheet[stateStyleDeclName]
      }
    }
    // May be undefined if styleSheet does not exist
    if (stateStyleSheet &&
        (util.isArray(stateStyleSheet) ||
         util.isObject(stateStyleSheet) ||
         util.isNumber(stateStyleSheet))) {
      sheets.push(stateStyleSheet)
    }

    // Handle adding state styles for child components
    //if (util.isString(stateStyle)) {
      //childComponentNames.forEach((attrName) => {
        //stateStyleDeclName = ns.getChildStateClassName(attrName, stateStyle)
        //stateStyleSheet = styleSheet[stateStyleDeclName]
        //if (stateStyleSheet) {
          //sheets.push(stateStyleSheet)
        //}
      //})
    //}
  }
  return sheets
}

export default [

  [
    'mapPropsToComponent',
    (pluginOptions) => {
      const {
        props,
        options,
        definition,
        plugins,
        ns,
        styleSheet,
        childComponentNames,
        mutableStyleValues} = pluginOptions
      const {mapPropsToComponent} = options
      const {Type, initialStyles} = definition
      const target = {}

      childComponentNames.forEach((attrName) => {
        let sheets = []

        const defaults = initialStyles[attrName]
        if (isObject(defaults)) {
          sheets.push(defaults)
        }

        // Add base class name (parent component)
        // style sheet
        //if (styleSheet[ns.componentClassName]) {
          //sheets.push(styleSheet[ns.componentClassName])
        //}

        // Add child class name style sheet
        const styleRuleName = ns.getChildClassName(attrName)
        if (styleSheet[styleRuleName]) {
          sheets.push(styleSheet[styleRuleName])
        }

        const stateSheets = mapPropsToStateStyle({...pluginOptions, attrName})
        sheets = sheets.concat(stateSheets)

        // TODO: handle state!!?

        const source = mapPropsToComponent[attrName]
        const target = {}
        let matched = false
        // NOTE: child component style objects are initialized in PrismComponent
        // NOTE: based on childComponentNames
        if (Array.isArray(source) && source.length) {

          const addMatched = (propName, propValue) => {
            const plugin = plugins.property.map[propName]
            if (plugin) {
              const prop = propValue
              const style = plugin.func({...pluginOptions, prop, propName})
              if (style !== undefined) {
                sheets = sheets.concat(style)
              }
            } else {
              target[propName] = propValue
              matched = true
            }
          }

          source.forEach((propName) => {
            if (isString(propName) && props[propName] !== undefined) {
              // Get from the processed property so we can respect color names
              addMatched(propName, props[propName])
            } else if (isObject(propName)) {
              const propertyNames = Object.keys(propName)
              propertyNames.forEach((childPropName) => {
                let stylePropName = childPropName
                // Rewriting the style property name
                if (isString(propName[childPropName])) {
                  stylePropName = propName[childPropName]
                }

                if (props[childPropName] !== undefined) {
                  // Get from the processed property so we can respect color names
                  addMatched(stylePropName, props[childPropName])
                }
              })
            }
          })
        }
        if (matched) {
          sheets.push(target)
        }
        //console.log('Final sheets for:' + attrName)
        //console.log(StyleSheet.flatten(sheets))
        mutableStyleValues[attrName] = sheets
      })
    },
    {},
    true
  ],

  [
    'mapStyleToProp',
    ({props, sheets, options, util, definition, mutableStyleValues}) => {
      const {mapStyleToProp} = options
      const {Type} = definition
      const {isString} = util
      if (mapStyleToProp) {
        const flat = StyleSheet.flatten(sheets)
        let k
        let v
        let key
        for (k in mapStyleToProp) {
          key = k
          v = mapStyleToProp[k]
          if (v) {
            // Rewrite prop name
            if (isString(v)) {
              key = v
            }
            // Note look up in the props before the style sheet
            const value = flat[k]
            if (value !== undefined) {
              mutableStyleValues[key] = value
            }
          }
          // Must always remove the style prop
          // likely an invariant
          delete flat[k]
        }
        const res = [flat]
        res.overwrite = true
        return res
      }
    }
  ],

  [
    'mapPropsToStyleState',
    mapPropsToStyleState
  ],

  // Support for mapPropsToStyle
  [
    'mapPropsToStyle',
    ({props, options, registry, util, ns}) => {
      const {mapPropsToStyle} = options
      if (mapPropsToStyle !== undefined) {
        const sheets = []
        let map = mapPropsToStyle
        if (util.isFunction(map)) {
          map = mapPropsToStyle(registry)
        }
        for (let k in map) {
          const prop = props[k]
          if (props.hasOwnProperty(k) && prop !== undefined) {
            const fn = map[k]
            // TODO: verify ahead of time?
            if (util.isFunction(fn)) {
              const sheet = fn({...registry, options, ns, props, prop})
              if (sheet !== undefined) {
                sheets.push(sheet)
              }
            }
          }
        }
        return sheets
      }
    }
  ],

  // Support for className
  [
    ({prop, styleSheet}) => {
      const className = prop
      const find = (list) => {
        return list
          .filter((nm) => styleSheet.hasOwnProperty(nm))
          .map((nm) => styleSheet[nm])
      }

      if (Array.isArray(className)) {
        return find(className)
      }

      return find(className.split(/\s+/))
    },
    {className: propTypes.className}
  ],


]
