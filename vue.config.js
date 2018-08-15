const webpack = require('webpack')

// vue.config.js
module.exports = {
  configureWebpack: {
    plugins: [
      new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/)
    ]
  },
  productionSourceMap: false,
  css: {
    sourceMap: false
  }
}
