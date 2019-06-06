// // import path from 'path'
// // // import { getOptions } from 'loader-utils'

// export default function (source: string) {
// 	// const callback = this.async()
// 	// const headerPath = path.resolve('header.js')

// 	// this.addDependency(headerPath)
// 	// if (err) return callback(err)
// 	// callback(null, header + '\n' + source)

// }

import webpack from 'webpack'
import { getOptions } from 'loader-utils';

export default function(this: webpack.loader.LoaderContext, source: string) {
  const options = getOptions(this);

  source = source.replace(/\[name\]/g, options.name);

  return `export default ${ JSON.stringify(source) }`;
}
