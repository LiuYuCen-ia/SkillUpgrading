// 创建连接
const { constants } = require('buffer');
const net = require('net')

class ResponseParser {
    constructor () {
        // 等 \r 或者 \n
        this.WAITING_STATUS_LINE = 0; // 开始等待 \r
        this.WAITING_STATUS_LINE_END = 1;// 等待 \n;
        this.WAITING_HEADER_NAME = 2;
        this.WAITING_HEADER_SPACE = 3;
        this.WAITING_HEADER_VALUE = 4
        this.WAITING_HEADER_LINE_END = 5;
        this.WAITING_HEADER_BLOCK_END = 6;
        this.WANITING_BODY = 7;
        //设置初始状态
        this.current = this.WAITING_STATUS_LINE;
        this.statusLine = "";
        this.headers = {};
        this.headersName = "";
        this.headersValue = "";
        this.bodyParser = null;
    }
    get isFinishcd() {
        return this.bodyParser && this.bodyParser.isFinishcd;
    }
    get response() {
        this.statusLine.match(/HTTP\/1.1([0-9]+) ([\s\s]+)/)
        return {
            statusCode : RegExp.$1,
            statusText : RegExp.$2,
            headers : this.headers,
            body : this.bodyText.join('')
        }
    }
    receive (string) {
        for(let i = 0; i < string.length; i++) {
            this.receiveChar(string.charAt(i))
        }
    }
    receiveChar (char) {
        if(this.current === this.WAITING_STATUS_LINE) {
            if(char === '\r'){
                this.current = this.WAITING_HEADER_LINE_END;
            }else {
                this.statusLine += char;
            }
        }else if(this.current === this.WAITING_HEADER_LINE_END) {
            if(this.current === '\n'){
                this.current = this.WAITING_HEADER_NAME
            }
        }else if(this.current === this.WAITING_HEADER_NAME){
            if(char === ":") {
                this.current = this.WAITING_HEADER_SPACE;
            }else if(char === "\r"){
                this.current = this.WAITING_HEADER_BLOCK_END;
                if(this.headers['Transfer-Encoding'] === 'chunked'){
                    this.bodyParser = new TrunkedBodyParser()
                }
            }else {
                this.headersName += char; 
            }
        }else if(this.current === this.WAITING_HEADER_SPACE){
            if(char === ' ') { // 分割 k：v
                this.current = this.WAITING_HEADER_VALUE;
            }
        }else if(this.current === this.WAITING_HEADER_VALUE){
            if(char === '\r'){
                this.current = this.WAITING_HEADER_LINE_END
                this.headers[this.headersName] = this.headersValue
                this.headersName = '';
                this.headersValue = "";
            }
        }
    }
}
// 使用状态机来实现
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
                if(this.length === 0) {
                    this.isFinished = true;
                }
                this.current = this.WAITING_LENGTH_LINE_END;
            }else {
                this.length *= 16; // 因为 传过来的 数据是 16 进制
                this.length += parseInt(char,16);
            }
        }else if(this.current === this.WAITING_LENGTH_LINE_END){
            if(char === '\n'){
                this.current = this.READING_TRUNK;
            }
        }else if(this.current === this.READING_TRUNK){
            this.content.push(char);
            this.length-- ;
            if(this.length === 0) {
                this.current = this.WAITING_NEW_LINE;
            }
        }else if(this.WAITING_NEW_LINE){
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



class Requset { // 创建接收类
    constructor(options){
        // 初始化数据
        this.headers = options.headers || {};// 接收的请求头；
        this.host = options.host; // 请求的IP地址
        this.port = options.port; // 请求的端口号
        this.path = options.path || '/'; // 获取请求的路径，或者默认路径
        this.method = options.method || 'GET';// 传入的 或者 默认的
        this.body = options.body || {};// 初始化 body 
        if(!this.headers['Content-Type']){ // 判断 headers
            this.headers['Content-Type'] = 'application/x-www-form-urlencoded'
        }
        if(this.headers['Content-Type'] === 'appliction/json'){ 
            this.bodyText = JSON.stringify(this.body);
        }
        else if(this.headers['Content-Type']==='application/json'){
            this.bodyText = Object.keys(this.body).map(key =>`${key}=${encodeURIComponent(this.body[key])}`).join('&')
        }
        this.headers['Content-Length'] = this.bodyText.length;
    }
    send(connection) { // 传入参数
        return new Promise((resolve,reject) => {
            const parser = new ResponseParser; // 解析 parser
            if(connection) {
                constants.write(this.toString());
            }else {
                connection = net.createConnection({
                    port:this.port,
                    host:this.host
                },() =>{
                    console.log('创建成功')
                    connection.write(this.toString()) //发送数据
                })
            }
            connection.on('data',(data) =>{ //监听data数据
                console.log(data.toString())
                parser.receive(data.toString())
                if(parser.isFinishcd){
                    resolve(parser.response);
                    connection.end()
                }
            })
            connection.on('error',(err)=>{ // 监听错误
                reject(err);
                connection.end();// 结束
            })
        })
    }
    toString() { // 拼接为 'POST /HTTP/1.1\r\n Content-Type: text/html Connction:keep-alive 
        return `${this.method} ${this.path} HTTP/1.1\r\n${Object.keys(this.headers).map(key => `${key}: ${this.headers[key]}`).join('\r\n')}\r\n${this.bodyText}`
    }
}
void async function (){
    let requset = new Requset({
        method:'POST',// 请求类型
        host:'127.0.0.1',// ip地址
        port:8088,// 端口号
        path:'/',// 请求路径
        body:{
            name:'Lucas Cen',
        },
        headers:{
            ['X-Foo2']:'coustomed'
        }
    })
    let response = await requset.send();
}()