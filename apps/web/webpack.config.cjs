const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = (_, argv) => ({
  mode: argv.mode || 'development', entry: path.resolve(__dirname, 'src/main.tsx'),
  output: { path: path.resolve(__dirname, 'dist'), filename: 'assets/app.[contenthash].js', clean: true, publicPath: '/' },
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
  module: { rules: [
    { test: /\.tsx?$/, exclude: /node_modules/, use: { loader: 'ts-loader', options: { compilerOptions: { noEmit: false } } } },
    { test: /\.css$/, use: ['style-loader', 'css-loader'] },
  ] },
  plugins: [new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'index.html') })],
  devServer: { host: '127.0.0.1', port: 5173, historyApiFallback: true, client: { overlay: true } },
  devtool: argv.mode === 'production' ? 'source-map' : 'eval-cheap-module-source-map',
  optimization: { splitChunks: { chunks: 'all' } },
});
