var port = process.env.OPENSHIFT_NODEJS_PORT || process.env.VCAP_APP_PORT || process.env.PORT || process.argv[2] || 8080;

var Gun = require('gun/gun');
Gun.serve = require('gun/lib/serve');
//require('gun/lib/wsp/server');
require('gun/lib/uws');
require('./index');
var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
	for (var i = 0; i < numCPUs; i++) {
	  cluster.fork();
	}
	cluster.on('online', function(worker) {
	  console.log('Worker ' + worker.process.pid + ' is online');
	});

	cluster.on('exit', function(worker, code, signal) {
	  console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
	  console.log('Starting a new worker');
	  cluster.fork();
	});
} else {

	var server = http.createServer(function(req, res){
		if(Gun.serve(req, res)){ return } // filters gun requests!
	  //res.writeHead(200);
	  //res.end('process ' + process.pid + ' says hello!');
	  //return;
		require('fs').createReadStream(require('path').join(__dirname, req.url)).on('error',function(){ // static files!
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end(require('fs')
				.readFileSync(require('path')
				.join(__dirname, 'index.html') // or default to index
			));
		}).pipe(res); // stream
	});

	var gun = Gun({ 
		file: 'data.json',
		web: server,
		s3: {
			key: '', // AWS Access Key
			secret: '', // AWS Secret Token
			bucket: '' // The bucket you want to save into
		}
	});

	server.listen(port);

	console.log('Server started on port ' + port + ' with /gun');

}