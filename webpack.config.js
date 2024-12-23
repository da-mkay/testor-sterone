const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: './src/bin.ts',
    mode: 'production',
    target: 'node',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        configFile: 'tsconfig.build.json',
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'testor-sterone.js',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true })],
};
