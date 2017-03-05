var Gun = require('gun/gun');
var cluster = require('cluster');

var CPU = require('os').cpus().length, cpu = CPU;
var workers = {};

if(CPU == 1){
	// do nothing!
} else
if(cluster.isMaster){
	master();
} else {
	worker();
}

function master(){
	
	while(cpu--){
		workers[cpu] = null;
	}

	cluster.on('online', function(worker){
		worker.shard = take(worker, workers);
		worker.on('message', function split(at){
			var to, tmp;
			if(at.pid){
				return Gun.obj.map(workers, function(worker){
					if(!worker){ return }
					worker.send(at);
				});
			}
			if(at.get){
				if(tmp = at.get['#']){
					to = workers[range(tmp, CPU)] || worker;
				} else {
					to = worker;
				}
				to.send(at);
				return;
			}
			if(at.put){
				// always select the first item as the shard key, just because that is simple to do.
				Gun.obj.map(at.put, function(node, soul){
					return tmp = soul;
				});
				to = workers[range(tmp, CPU)] || worker;
				to.send(at);
				return;
			}
			at.pid = process.pid;
			split(at);
		});
	});
	
	cluster.on('exit', function(worker, code, signal){
		if(workers[worker.shard]){
			workers[worker.shard] = null;
		}
	});
}

function worker(){
	var u, root; // race condition!
	Gun.on('opt', function(at){
		if(at.once){ return this.to.next(at) }
		root = at.gun.back(-1); // race condition!
		at.gun.on('in', shard);
		this.to.next(at);
	});
	process.on('message', function(at){
		if(at.pid){
			return Gun.on('out', at);
		}
		at.pid = process.pid;
		root.on('in', at);
	});
	Gun.on('out', function(at){
		if(at.pid && !at.gun){
			at.gun = root; // race condition!
			return this.to.next(at);
		}
		at.pid = process.pid;
		process.send(at);
	});
}

function shard(at){
	if(process.pid == at.pid){
		return this.to.next(at);
	}
	process.send(at);
}

function take(worker, workers){
	return Gun.obj.map(workers, function(v, i){
		if(v){ return }
		workers[i] = worker;
		return i;
	});
}

function range(str, by){
	if(!str){ return 0 }
	var c = 0, i = str.length;
	while(i--){
		c ^= str.charCodeAt(i) || 0;
	}
	return (c % (by || 4));
}

(function(){ return;
	// proof that `range` is decent enough:
	var check = {};
	var stuff = "1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	stuff = new Array(); stuff.fill(999999, 1);
	var i = 10000;
	while(i--){
		var c = Gun.text.random(999);
		var n = range(c, 20);
		check[n] = (check[n] || 0) + 1;
	}
	console.log(check); // the numbers should all be close to each other.
}());