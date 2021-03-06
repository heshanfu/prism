## Appendix

### Platform Styles

You can use platform specific styles for your fonts and style sheets by using the standard notation passed to `Platform.select()`.

If you need a platform-specific font family specify an object in your fonts map:

```javascript
export default {
  regular: {
    ios: 'WorkSans-Regular',
    android: 'worksans'
  }
}
```

Platform-specific styles are merged over the top of default rules using a selective merge so you can overwrite declarations and inherit the other styles. To illustrate:

```javascript
export default {
  Label: {
    fontSize: 20,
    color: 'red'
  },
  android: {
    Label: {
      // Overwrite for android but inherit
      // fontSize from the top-level Label
      color: 'green'
    }
  }
}
```

### Color Names

Styles are much easier to change and we can add semantic meaning to our colors if we can refer to them by name, use the `colorNames` option to enable this functionality.

With the `colorNames` option enabled and a theme like:

```javascript
{
  colors: {
    primary: '#333333',
    muted: '#999999',
  },
  styles: ({colors}) => {
    return {
      Label: {
        fontSize: 16,
        color: colors.primary
      }
    }
  }
}
```

You can now override the color by name:

```html
<Label color='muted' />
```

To work in all scenarios (default properties, style sheets and properties) this logic is implemented as a [processor](#processor) and adds overhead therefore it is not enabled by default.

Consider that there may be a better way for your application to manage named colors internally before enabling this option.

### Flat Styles

Sometimes you are wrapping a third-party component and want to proxy the `style` object to the component but it does not accept an array for the `style` property; it enforces an object only property type.

The computed `style` property passed to your component is guaranteed to be an array; here however we need it to be an object. To do so you can use the `flat` option:

```javascript
static styleOptions = {
  flat: true
}
```

Now you can just proxy it to the child component knowing it will be an object:

```javascript
render () {
  const {style} = this.props
  return (
    <NonIdiomaticComponent style={style} />
  )
}
```

Flat styles are applied to [child components](#child-components) too.

<? @include plugins.md ?>

### Processor

Processors are plugins that operate on a *flat representation* of the computed styles, they are used to support named colors and invariants. The default configuration does not enable any processors but it is worth knowing that certain configuration options add some processing overhead:

* `colorNames`
* `textTransform`

### Invariants

Invariants are unknown style declarations that would trigger an error when compiling style sheets with `StyleSheet.create()`. This strict behaviour of RN is very useful but there are occasions where it makes more sense to put the information in a style sheet and invariants allow us to do that. Internally they are extracted as invariant style rules and later resolved when styles are computed.

An example of this is `tintColor` where we need to assign to the `tintColor` property of `ActivityIndicator` but really it's styling information and is better suited to being in a style sheet.

Also the experimental `textTransform` property is treated as an invariant so it can be declared in style rules and processed using the plugin system yet never appear in compiled or computed style sheets.

Invariants use a processor to ensure computed styles do not contain these properties so they incur the same performance penalty.

### Best Practices

You are free to do as you please however here are some guidelines:

* Avoid setting styles in `defaultProps`.
* Use class name style rule for default styles (eg: `Label`).
* Prefer `className` as first option for style overrides.
* Use extended properties sparingly, useful for rapid devlopment, later migrate to `className`.
* Avoid inline `style` properties.

### Pure Mode

If you like the style sheet paradigm that Prism has but want to get closer to the metal we offer a pure mode of operation. When the `pure` configuration option is given plugins and style computation are disabled. Your components are given direct access to the style registry instead.

In pure mode your components are only passed two properties by the HOC:

* `styleRegistry` the application style registry.
* `styleSheet` alias for the registry style sheet.

Note that `style` is no longer passed!

Now you need to pass the styles manually by finding them in the registry:

```javascript
render () {
  const {styleSheet} = this.props
  <Text style={styleSheet.text}>
    {this.props.children}
  </Text>
}
```

Typically you would decide to use this mode of operation from the beginning. If you enable pure mode for an existing application using Prism features your views will revert to zero style.

This would apply to any third-party components you may be using too!

### Performance

We have made every effort to keep iterations and function calls to a bare minimum and in it's default configuration performance impact should be minimal.

However performance may be impacted if you use any of the following features as they all require a flat representation of the computed styles:

* [Processor](#processor) operate on flat computed styles.
* [Invariants](#invariants) implies use of a processor.
* [Flat Styles](#flat-styles) computes a component-specific flat stylesheet.

And of course caveat emptor this is not the sort of thing you want to use to style say many thousands of game sprites.
