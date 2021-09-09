function match (string) {
    let state = start; // 用来保存状态
    for(let i of string) {
        state = state(i)
    }
    return state === end;
}
function end(i) {
    return end;
}
function start(i) {
    if(i === 'a'){
        return FundA;
    }else{
        return start;
    }
}
function FundA(i) {
    if(i === 'b') {
        return FundB;
    }else {
        return start(i); // 将参数回传让其第一项进行判断是否继续进行
    }
}
function FundB(i) {
    if(i === 'a'){
        return FundA1;
    }else{
        return start(i);
    }
} 
function FundA1(i) {
    if(i === 'b') {
        return FundB2;
    }else {
        return start(i)
    }
}
function FundB2(i){
    if(i === 'x'){
        return end;
    }else {
        return FundA1(i); // 回到上一层进行判断；
    }
}