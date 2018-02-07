import React, {Component} from 'react';
import {Prism, StyleRegistry} from '../../src/Prism'
import theme from './theme'
import Label from './Label'

const registry = new StyleRegistry({theme})
Prism.configure(
  registry,
  {
    extendedProperties: true,
    experimentalPlugins: true,
    textTransform: true,
    colorNames: true
  }
)
export default class Application extends Component {
  render () {
    return (
      <Label
        background='steelblue'
        color='white'
        bold
        align='center'
        textTransform='capitalize'
        padding={15}>
        Prism example application
      </Label>
    )
  }
}
