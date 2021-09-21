const net = require('net');
const parse = require('./parser.js')
class ResponseParser {
    constructor () {
        // \r \n是两状态
        this.WAITING_STATUS_LINE = 0;//开始等待  为 \r 的时候开始等待
        this.WAITING_STATUS_LIEN_END = 1; // 需要等一个 \n 才能进行到 HEADER状态
        this.WAITING_HEADER_NAME = 2;
        this.WAITING_HEADER_SPACE = 3;
        this.WAITING_HEADER_VALUE = 4;
        this.WAITING_HEADER_LINE_END = 5;
        this.WAITING_HEADER_BLOCK_END = 6;
        this.WAITING_BODY = 7
        //置为初始状态
        this.current = this.WAITING_STATUS_LINE;
        this.statusLine = "";
        this.headers = {};
        this.headerName = "";
        this.headerValue = "";
        this.bodyParser = null;
    }
    get isFinished() {
        return this.bodyParser && this.bodyParser.isFinished
    }
    get response() {
        this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/);
        return {
            statusCode : RegExp.$1,
            statusText : RegExp.$2,
            headers: this.headers,
            body : this.bodyParser.content.join('')
        }
        
    }
    receive (string) { // 自定义方法 拿到数据后进行处理
        console.log(string.length)
        for(let i = 0; i < string.length; i++) {    
            this.receiveChar(string.charAt(i))
        }
    }
    receiveChar (char) { // 对传入的状态逐个处理
        // 区分状态
        if(this.current === this.WAITING_STATUS_LINE){
            if(char === '\r'){
                this.current = this.WAITING_STATUS_LINE_END;
            }else{
                this.statusLine += char;
            }
        }else if(this.current === this.WAITING_STATUS_LINE_END){
            if(char === '\n') {
                this.current = this.WAITING_HEADER_NAME;
            }
        }else if(this.current === this.WAITING_HEADER_NAME){
             if(char === ":"){
                this.current = this.WAITING_HEADER_SPACE;
             }
             else if(char === '\r'){
                this.current = this.WAITING_HEADER_BLOCK_END;
                if(this.headers['Transfer-Encoding'] === 'chunked'){
                    this.bodyParser = new TrunkedBodyParser();
                }
            }else {
                this.headerName += char;
            }
        }else if(this.current === this.WAITING_HEADER_SPACE){
            if(char === ' '){ // 分割 key ： value
                this.current = this.WAITING_HEADER_VALUE;
            }
        }else if(this.current === this.WAITING_HEADER_VALUE){
            if(char === '\r'){
                this.current = this.WAITING_HEADER_LINE_END;
                this.headers[this.headerName] = this.headerValue
                this.headerName = '';
                this.headerValue = "";
            }else {
                this.headerValue += char;
            }
        }else if(this.current === this.WAITING_HEADER_LINE_END){
            if(char === '\n'){
                this.current = this.WAITING_HEADER_NAME;
            }
        }else if(this.current === this.WAITING_HEADER_BLOCK_END){
            if(char === '\n'){
                this.current = this.WAITING_BODY;
            }
        }else if(this.current === this.WAITING_BODY) { 
            // 当遇到 this.WAITING_BODY 将所有 charactar 交给 this.bodyParse 处理
            this.bodyParser.receiveChar(char)
            // console.log(char)
        }
    }
}

class TrunkedBodyParser {
    constructor () {
        this.WAITING_LENGTH = 0;
        this.WAITING_LENGTH_LINE_END = 1;
        this.READING_TRUNK = 2; // 控制trunk的长度
        this.WAITING_NEW_LINE = 3;
        this.WAITING_NEW_LINE_END = 4;
        this.length = 0;
        this.content = [];
        this.isFinished = false;
        this.current = this.WAITING_LENGTH;
    }
    receiveChar(char) {
        if(this.current === this.WAITING_LENGTH){
            if(char === '\r'){
                    if(this.length === 0){
                        this.isFinished = true;
                    }
                    this.current = this.WAITING_LENGTH_LINE_END
            }else {
                this.length *= 16;
                this.length += parseInt(char,16);
            }
        }else if(this.current === this.WAITING_LENGTH_LINE_END){
            if(char === '\n'){
                this.current = this.READING_TRUNK;
            }
        }else if(this.current === this.READING_TRUNK){
            this.content.push(char);
            this.length --;
            if(this.length === 0) {
                this.current = this.WAITING_NEW_LINE;
            }
        }else if(this.current === this.WAITING_NEW_LINE){
            if(char === '\r') {
                this.current = this.WAITING_NEW_LINE_END;
            }
        }else if(this.current === this.WAITING_NEW_LINE_END){
            if(char === '\n') {
                this.current = this.WAITING_LENGTH;
            }
        }
    }
}





class Request {
    constructor (options) {
        this.method = options.method || 'GET'; // 定义 methods 并返回默认值
        this.host = options.host; // host IP地址
        this.port = options.port || 80; // 端口号
        this.path = options.path || '/'; // 请求路径
        this.body = options.body || {}; // 返回的数据
        this.headers = options.headers || {}; // 设置 请求头
        // console.log(!this.headers['Content-Type'])
        if(!this.headers['Content-Type']){ // 设置默认请求头
            this.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        
        if(this.headers['Content-Type'] === 'application/json'){
            //定一个 bodyText 来进行存储
            this.bodyText = JSON.stringify(this.body); // 将其body进行解析
        }
        else if(this.headers['Content-Type'] === 'application/x-www-form-urlencoded'){ // 当给定请求头，队其进行处理
            // Object.keys()  将传入的对象 遍历, 将键 放入一个数组中
            this.bodyText = Object.keys(this.body).map(key => `${key}=${encodeURIComponent(this.body[key])}`).join('&'); // encodeURIComponent 转译字符
        }
        // 如果 Content-Length 存在 直接赋值 
        this.headers['Content-Length'] = this.bodyText.length;
    }
    // 的实现，传入一个参数，当前的tcp连接，判断是否存在当前 tcp 连接，如果有tcp，直接对当前tcp连接进行处理。如果没有则利用当前，传入进来的进行创建tcp连接，并对当前tcp连接进行处理，监听  data 数据，在监听 error 数据 
    send(connection) {
        // 在 send 的过程 中回逐步接收到 response ,将 response 构造结束 在去 resolve  
        return new Promise((resolve,reject) =>{ //返回
            const parser = new ResponseParser;
            if(connection) { // 如果  当前 connection存在 
                connection.write(this.toString())
            }else { //否则 利用传入进来的 port 和 host  创建连接
                connection = net.createConnection({
                    host : this.host,
                    port : this.port,
                }, () =>{ // 进行回调函数
                    // console.log('创建成功')
                    connection.write(this.toString())
                })
            }
            connection.on('data',(data) => { // 对当前 data 进行处理
                // console.log('接收到了data',data.toString())
                parser.receive(data.toString())
                // console.log(parser.response)
                if(parser.isFinished ) {
                    resolve(parser.response);
                }
                connection.end();
            });
            connection.on('error',(err) => {
                reject(err);
                connection.end();
            })

        })
    }
    toString () {
        return `${this.method} ${this.path} HTTP/1.1\r
${Object.keys(this.headers).map(key => `${key}: ${this.headers[key]}`).join('\r\n')}\r
\r
${this.bodyText }`    
 }

}
    
void async function () { 
    let request = new Request({
        method:'POST', //请求方式
        host:'127.0.0.1', // 请求IP
        port:8080,//端口
        path:'/', // 请求路径
        headers : {
            ['X-Foo2']: 'coustomed'
        },
        body : {
            name:'Lucas Cen'
        }
    })
    let response = await request.send();
    let dom = parse.parseHTML(response.body);
    console.log(JSON.stringify(dom,null, "   "))
}()
