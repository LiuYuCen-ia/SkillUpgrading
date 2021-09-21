const http = require("http"); // 引入 http 包
//创建服务器
http
  .createServer((request, response) => {
    let body = [];
    request
      .on("error", (err) => {
        // on 表示 注册一个监听器，触发事件以后的回调函数
        console.error(err);
      })
      .on("data", (chunk) => {
        // 当前的chunk 已经是 Buffer 类型了
        
        body.push(chunk);
      })
      .on("end", () => {
        body = Buffer.concat(body).toString();
        console.log(body)
        response.writeHead(200, { "Content-Type": "text/html" }); //设置请求头
        response.end(`
<html lang="en">
<head>
    <style>
        div {
          width : 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        askldjlk 
    </div>
</body>
</html>`);
      });
  })
  .listen(8080);
console.log("server started");
