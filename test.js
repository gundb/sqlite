try{require('fs').unlinkSync('data.sqlite3');
}catch(e){}

require('./index');

global.Gun = require('gun/gun');

require('gun/test/abc');