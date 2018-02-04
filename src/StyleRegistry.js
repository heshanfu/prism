import {Platform, StyleSheet} from 'react-native'

import util from './util'
const {isFunction, isObject, isString} = util

export default class StyleRegistry {
  fonts = {}
  sizes = {}
  colors = {}
  colorNames = []
  styles = {}
  styleSheet = {}
  styleInvariants = {}

  assign (registry) {
    this.mergeColors(registry.colors)
    this.mergeFonts(registry.fonts)
    this.mergeStyles(registry.styles)
    this.mergeStyleInvariants(registry.styleInvariants)
  }

  mergeColors (colors) {
    this.colors = Object.assign({}, colors, this.colors)
    this.colorNames = Object.keys(this.colors)
  }

  mergeFonts (fonts) {
    this.fonts = Object.assign({}, fonts, this.fonts)
  }

  mergeStyles (styles) {
    this.styles = Object.assign({}, styles, this.styles)
  }

  mergeStyleInvariants (styleInvariants) {
    this.styleInvariants = Object.assign({}, styleInvariants, this.styleInvariants)
  }

  addColors (colors) {
    this.colors =
      Object.assign(this.colors, colors)
    this.colorNames = Object.keys(this.colors)
  }

  addFonts (map) {
    if (!isObject(map)) {
      throw new Error('Prism registry fonts must be an object')
    }
    for (let k in map) {
      const fn = map[k]
      if (isFunction(fn)) {
        this.fonts[k] = fn(Platform.OS)
      } else if(isString(fn)) {
        this.fonts[k] = fn
      }
    }
  }

  addStyleSheet (styleSheet) {
    const {colors, fonts, colorNames} = this
    if (!isFunction(styleSheet) && !isObject(styleSheet)) {
      throw new Error('Prism registry styles must be a function or object')
    }
    if (isFunction(styleSheet)) {
      this.styles = Object.assign(
        {},
        styleSheet({colors, fonts, colorNames})
      )
    } else {
      this.styles = styleSheet
    }
  }

  addTheme (theme) {
    if (!isObject(theme)) {
      throw new Error('Prism theme should be an object')
    }
    if (theme.colors && !isObject(theme.colors)) {
      throw new Error('Prism theme colors should be an object')
    }
    if (theme.fonts && !isObject(theme.fonts)) {
      throw new Error('Prism theme fonts should be an object')
    }
    if (theme.styles && !isFunction(theme.styles)) {
      throw new Error('Prism theme styles should be a function')
    }
    if (theme.colors) {
      this.addColors(theme.colors)
    }
    if (theme.fonts) {
      this.addFonts(theme.fonts)
    }
    if (theme.styles) {
      this.addStyleSheet(theme.styles)
    }
  }

  // Lookup for font sizes is:
  //
  // 1. Component options `sizes`
  // 2. Style registry `sizes`
  // 3. Config `sizes`
  setFontSizes (sizes) {
    this.sizes = sizes
  }

  // Called to finalize the registry internally
  // do not call this directly
  compile ({config}) {
    const {invariants} = config
    if (invariants) {
      for (let decl in this.styles) {
        for (let styleProp in this.styles[decl]) {
          invariants.forEach((invariant) => {
            if (styleProp === invariant.stylePropName) {
              const value = this.styles[decl][styleProp]
              this.styleInvariants[decl] = Object.assign({}, invariant, {value})
              // Must delete to avoid StyleSheet.create() type validation error
              delete this.styles[decl][styleProp]
            }
          })
        }
      }
    }
    this.styleSheet = StyleSheet.create(this.styles)
  }
}
