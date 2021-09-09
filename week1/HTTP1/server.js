// 创建服务器
const http = require('http');
http.createServer((request,response) => {
    let body = []; // 
    request.on('error',(err) => {
        console.error(err)
    }).on('data',(chunk) => {
        body.push(chunk); // 将传回来的参数全部变为字符串类型
    }).on('end',() => {
        body = Buffer.concat(body).toString(); //  连接body的内容
        console.log(body);
        response.writeHead(200,{'Content-Type':'text/html'});// 设置请求头
    })
}).listen(8088) //创建服务器成功，端口号为8088
console.log('server started')