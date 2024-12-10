const path = require('path');

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
        filename: 'testor.js',
        path: path.resolve(__dirname, 'dist'),
    },
};
