const css = require('css')


let currentToken = null; // 用来构造token内容
let currentAttribute = null;

let stack = [{type:"document",children:[]}]; // 有初始的结点
let currentTextNode = null;

// 把css 规则暂存在数组里
let rules = []
// 将 css  进行解析 生成 ast 树
function addCSSRules (text) {
    var ast = css.parse(text);
    rules.push(...ast.stylesheet.rules)
}

function match(element,selector) { // 接收元素,接收选择器
    if(!selector || !element.attributes) { // 没有选择器或者没有元素直接返回
        return false
    }
    if(selector.charAt(0) == "#"){ //判断是否是id选择器
        var attr = element.attributes.filter(attr => attr.name == "id")[0]; // 取出 attr 看看是否有值
        if(attr && attr.value === selector.replace('#','')){
            return true;
        }
    }else if(selector.charAt('.') == '.') { // 判断是否是类选择器
        var atrr = element.attributes.filter(attr => attr.name === 'class')[0];
        if(atrr && attr.value == selector.replace('.','')){
            return true;
        }
    }else {
        if(element.tagName == selector) {
            return true;
        }
    }
    return false;

}
//css计算逻辑：
function specificity(selector) {
    var p = [0,0,0,0];
    var selectorParts = selector.split(" ")
    for(var part of selectorParts) {
        if(part.charAt(0) == '#') { // 判断微 id 的时候
            p[1] += 1;
        }else if(part.charAt(0) == '.') { // 判断 class
            p[2] += 1;
        }else { // 判断标签
            p[3] += 1; 
        }
    }
    return p;
}
// 返回状态
function compare (sp1,sp2) {
    if(sp1[0] - sp2[0]) 
        return sp1[0] - sp2[0];
    if(sp1[1] - sp2[1])
        return sp1[1] - sp2[1];
    if(sp1[2] - sp2[2])
        return sp1[2] - sp2[2]
    return sp1[3] - sp2[3]
}




//计算 css 属性 
function computeCSS(element) {
    var elements = stack.slice().reverse(); // 最先获取当前元素,一级一级往父元素查找
    if(!element.computedStyle) { // 判断没有这个样式返回一个空的样式
        element.computedStyle = {}
    }
    for(let rule of rules) { // 循环选择器
        var selectorParts = rule.selectors[0].split(" ").reverse();
        if(!match(element,selectorParts[0])) {//selectorParts[0] 选择器 和 当前 元素判断是否匹配 
            continue;
        }
        let matched = false;
        var j = 1; // 表示当前选择器所在位置
        for(var i = 0; i < elements.length; i++) { // 用来检测父元素
            if(match(elements[i],selectorParts[j])){ //判断当前元素和当前选择器 如果匹配,当前选择器往上查找,否则元素往上找
                j++;
            }
        }
        if(j >= selectorParts.length) { // 判断当前选择器是否全部匹配
            matched = true;
        }
        if(matched) {
            //匹配成功，将css 属性 应用上
            var sp = specificity(rule.selectors[0])// 计算传入的选择器所在位置的 并保存 返回的四元组
            var computedStyle = element.computedStyle;
            for(let declaration of rule.declarations) {
                if(!computedStyle[declaration.property]){
                    computedStyle[declaration.property] = {};
                }
                if(!computedStyle[declaration.property].specificity) {
                    computedStyle[declaration.property].value = declaration.value
                    computedStyle[declaration.property].specificity = sp; // 将得到 的 四原组赋值给
                }else if(compare(computedStyle[declaration.property].specificity,sp) < 0){ // 更新优先级
                    computedStyle[declaration.property].value = declaration.value
                    computedStyle[declaration.property].specificity = sp;
                }
               
            }
        }
    }
}

function emit(toKen) { // 全局创建token，同一个出口输出token
    // 使用 tokens 流 来创建  dom 树  
   
    let top = stack[stack.length - 1]; // 去出栈顶元素
    if(toKen.type == 'startTag') { // 开始标签
        let element = {
            type : 'element',
            children:[],
            attributes : []
        };
        element.tagName = toKen.tagName;
        for(let p in toKen) { // 除了 type 和 tagNmae 的属性全部push到 element里面 的属性的 池 里面
            if(p != "type" && p != "tagName") {
                element.attributes.push({
                    name:p,
                    value:toKen[p]
                })
            }
        }
        computeCSS(element) // 计算 css 属性

        top.children.push(element);
            // element.parent = top; // 将元素的 parent 设置为 top
            if(!toKen.isSelfConfig) { // 判断是否是自封闭标签
                stack.push(element)
            }
            currentTextNode = null;
    }else if(toKen.type == "endTag"){ //当是结束标签的时候
        if(top.tagName != toKen.tagName){
            throw new Error("Tag start end doesn't match!")
        }else {
            if(top.tagName === 'style'){
                addCSSRules(top.children[0].content)
            }
            //在结束之前引用
            console.log(top)
            stack.pop();
        }
        currentTextNode = null;
    }else  if(toKen.type === 'text'){  //添加文本结点
       if(currentTextNode == null) {// 是否结束上一个标签
            currentTextNode = { // 创建一个文本结点
                type:'text',
                content:""
            }
            top.children.push(currentTextNode); // 添加当前文本标签
       }
       currentTextNode.content += toKen.content;
    }
    
}

const EOF = Symbol('EOF'); // 用来给定一个额外的字符，使用了 Symbol的唯一性
function data (i) {
    if(i == "<") { // 表示开始标签
        return tagOpen;
    }else if(i == EOF) {
        emit({
            type:'EOF'
        })
        // console.log(stack[0])
        return ;
    } else {
        emit({
            type:"text",
            content:i,
        })
        return data;
    }
}
function tagOpen (i){
    if(i == '/'){ // 表示标签的结束;
        return endTagOpen;
    }else if(i.match(/^[a-zA-Z]$/)) { // 获取标签的name
        // 创建  token 遇到 < 开头 并且 是字母则 创建  
        currentToken = {
            type:'startTag',
            tagName:'',
        }
        return tagName(i)
    }else {
        emit ({
            type:'text',
            content: i,
        })
        return ;
    }
}
function endTagOpen (i) {
    if(i.match(/^[a-zA-Z]$/)){
        currentToken = { //遇到了 endTagOpen状态 创建 endTag 标签 token
            type:'endTag',
            tagName:'',
        }
        return tagName(i);
    }else if(i == ">") { // 报错
        
    }else if(i == EOF){ // 也会报错

    }else{

    }
}
function tagName(i) {
    if(i.match(/^[\t\n\f ]$/)){ // 表示标签遇到了 碰见了属性
        return beforeAttributeName;
    }else if(i == '/'){ //自封闭标签
        return selfClosingStartTag; 
    }else if(i.match(/^[a-zA-Z]$/)){
        currentToken.tagName += i; //如果是字符则追加到 currentToken 下的 tagName 下i
        return tagName;
    }else if(i == ">") { // 普通的开始标签
        emit(currentToken);
        return data;
    }else {
        currentToken.tagName += i;
        return tagName;
    }
}
function beforeAttributeName(i){
    if(i.match(/^[\t\n\f ]$/)) {//进入到出了属性的状态
        return beforeAttributeName; // 完整的属性结束了
    }else if(i == ">" || i == '/' || i == EOF) { // 碰见最后结束的符号
        return afterAttributeName(i);
    }else if( i == "=") { // 属性开头不能遇见等号，遇见等号报错
        
    }else {
        currentAttribute = {
            name : '',
            value:''
        }
        return attributeName(i);
    }
}
function attributeName(i){
    if(i.match(/^[\t\n\f ]$/) || i == '/' || i == '>' || i == EOF){ // 判断是否是空格
        return afterAttributeName(i); // 属性名
    }else if(i == '=') {
        return beforeAttributeValue; // 属性值
    }else if(i == '\u0000') {

    }else if(i == "\"" || i == "'" || i == "<") {
         // 保存
    }else {
        currentAttribute.name += i;
        return attributeName;
    }
}
//
function beforeAttributeValue(i) {
    if(i.match(/^[\t\n\f ]$/) || i == '/' || i == '>' || i == EOF){
        return beforeAttributeValue;
    }else if("\""){ // 遇到双引号
        return doubleQuotedAttributeValue;
    }else if(i == "\'"){ // 遇到单引号 
        return singleQuotedAttributeValue;
    }else if(i == '>') {

    }else { // 没有特殊符号
        return UnquotedAttributeValue(i);
    }
}
// 找双引号
function doubleQuotedAttributeValue (i) {
    if(i == "\""){ // 只找双引号结束
        currentToken[currentAttribute.name] = currentAttribute.value
        return afterQuotedAttributeValue;
    }else if(i == "\u0000") {

    }else if(i == EOF) {

    }else {
        currentAttribute.value += i;
        return doubleQuotedAttributeValue;
    }
}

function afterAttributeName(i) {
    if(i.match(/^[\t\n\f ]$/)) {
        return afterAttributeName;
    }else if(i == "/") {
        return selfClosingStartTag;
    }else if(i == '=') {
        return beforeAttributeValue;
    }else if(i == ">") {
        currentToken[currentAttribute.name] = currentAttribute.value
        emit(currentToken);
        return data;
    }else if(i == EOF){

    }else {
        currentToken[currentAttribute.name] = currentAttribute.value;
        currentAttribute = {
            name:"",
            value : ""
        }
        return attributeName(i);
    }
}
//
function afterQuotedAttributeValue(i) {
    if(i.match(/^[\t\n\f ]$/)) {
        return beforeAttributeName;
    }else if(i == '/') {
        return selfClosingStartTag;
    }else if(i == ">") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    }else if(c == EOF) {

    }else {
        currentAttribute.value += i;
        return doubleQuotedAttributeValue;
    }
}

// 找单引号
function singleQuotedAttributeValue (i) {
    if(i == "\'") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    }else if(i == "\u0000") {

    }
    else if(i == EOF) {

    }else {
        currentAttribute.value += i
        return doubleQuotedAttributeValue;
    }
}
// 找空白 拼接 token
function UnquotedAttributeValue(i) {
    if(i.match(/^[\t\n\f ]$/)) {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return beforeAttributeName;
    }else if(i == '/'){
        currentToken[currentAttribute.name] = currentAttribute.value;
        return selfClosingStartTag;
    }else if(i == ">") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    }else if(i == "\u0000") {

    }else if(i == "\"" || i == "'" || i == "<" || i == "=" || i == '`') {

    }else if(i == EOF) {

    }else {
        currentAttribute.value += i;
        return UnquotedAttributeValue
    }
}


function selfClosingStartTag (i) {
    if(i == '>'){
        // 表示自封闭标签
        currentToken.isSelfConfig = true;
        return data;
    }else if(i == "EOF"){ // 结束标签，只等 > 号，否则报错
        
    }else {

    }
}

module.exports.parseHTML = function parseHTML(html){
    let state = data;
    for(let i of html){
        state = state(i)
    }
    state = state(EOF)
   return stack[0]
}