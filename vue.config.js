const webpack = require('webpack')

// vue.config.js
module.exports = {
  configureWebpack: {
    plugins: [
      new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
      new webpack.NormalModuleReplacementPlugin(/moment-timezone\/data\/packed\/latest\.json/, require.resolve('./timezone-defs.json'))
    ]
  },
  productionSourceMap: false,
  css: {
    sourceMap: false
  }
}
