export type TokenKind='number'|'bool'|'identifier'|'keyword'|'operator'|'punct'|'eof';
export type ValueType='int'|'bool'|'int[]'|'bool[]';
export type RuntimeArray={kind:'array';elementType:'int'|'bool';values:RuntimeValue[]};
export type RuntimeValue=number|boolean|RuntimeArray;

export interface Token{kind:TokenKind;value:string;line:number;column:number}

export class RoboError extends Error{
  constructor(message:string,public line=1,public column=1){
    super(message);
    this.name='RoboError';
  }
}

const keywords=new Set(['void','int','bool','if','else','for','return','true','false']);

export function lex(source:string):Token[]{
  const tokens:Token[]=[];
  let index=0;
  let line=1;
  let column=1;
  const push=(kind:TokenKind,value:string,startLine=line,startColumn=column)=>tokens.push({kind,value,line:startLine,column:startColumn});

  while(index<source.length){
    const char=source[index];
    if(/\s/.test(char)){
      if(char==='\n'){line++;column=1}else column++;
      index++;
      continue;
    }
    if(char==='/'&&source[index+1]==='/'){
      while(index<source.length&&source[index]!=='\n'){index++;column++}
      continue;
    }

    const startLine=line;
    const startColumn=column;
    if(/[0-9]/.test(char)){
      let value='';
      while(index<source.length&&/[0-9]/.test(source[index])){value+=source[index++];column++}
      push('number',value,startLine,startColumn);
      continue;
    }
    if(/[A-Za-z_]/.test(char)){
      let value='';
      while(index<source.length&&/[A-Za-z0-9_]/.test(source[index])){value+=source[index++];column++}
      push(keywords.has(value)?(value==='true'||value==='false'?'bool':'keyword'):'identifier',value,startLine,startColumn);
      continue;
    }

    const pair=source.slice(index,index+2);
    if(['<=','>=','==','!=','&&','||'].includes(pair)){
      push('operator',pair,startLine,startColumn);
      index+=2;
      column+=2;
      continue;
    }
    if('+-*/%<>!'.includes(char)){
      push('operator',char,startLine,startColumn);
      index++;
      column++;
      continue;
    }
    if('{}();,=[]'.includes(char)){
      push(char==='='?'operator':'punct',char,startLine,startColumn);
      index++;
      column++;
      continue;
    }
    throw new RoboError(`Unexpected character '${char}'`,startLine,startColumn);
  }

  push('eof','',line,column);
  return tokens;
}

interface SourceNode{line?:number;column?:number}
export type Expr=
  |({type:'literal';value:RuntimeValue}&SourceNode)
  |({type:'variable';name:string}&SourceNode)
  |({type:'array';name:string;index:Expr}&SourceNode)
  |({type:'unary';op:string;expr:Expr}&SourceNode)
  |({type:'binary';op:string;left:Expr;right:Expr}&SourceNode)
  |({type:'call';name:string;args:Expr[]}&SourceNode);
export type Stmt=
  |({type:'block';body:Stmt[]}&SourceNode)
  |({type:'if';test:Expr;then:Stmt;elseBranch?:Stmt}&SourceNode)
  |({type:'for';init?:Stmt;test:Expr;update?:Stmt;body:Stmt;maxIterations:number}&SourceNode)
  |({type:'return';value?:Expr}&SourceNode)
  |({type:'expr';expr:Expr}&SourceNode)
  |({type:'var';name:string;varType:ValueType;value?:Expr;size?:number}&SourceNode)
  |({type:'assign';name:string;value:Expr;index?:Expr}&SourceNode);
export interface FunctionDeclaration{returnType:'void'|ValueType;params:{name:string;type:ValueType}[];body:Stmt;line:number;column:number}
export interface Program{functions:Map<string,FunctionDeclaration>;globals:Stmt[]}

export class Parser{
  private index=0;
  constructor(private tokens:Token[]){}

  private current(){return this.tokens[this.index]}
  private is(value:string){return this.current().value===value}
  private eat(expected?:string){
    const token=this.current();
    if(expected&&token.value!==expected&&token.kind!==expected)throw new RoboError(`Expected '${expected}'`,token.line,token.column);
    this.index++;
    return token;
  }
  private eatType(allowVoid:boolean){
    const token=this.current();
    const allowed=allowVoid?['void','int','bool']:['int','bool'];
    if(!allowed.includes(token.value))throw new RoboError(`Expected ${allowVoid?'type':'int or bool'}`,token.line,token.column);
    this.index++;
    return token as Token&{value:'void'|'int'|'bool'};
  }
  private eatVariableType(){
    const base=this.eatType(false).value as 'int'|'bool';
    if(this.is('[')){this.eat('[');this.eat(']');return `${base}[]` as ValueType}
    return base as ValueType;
  }

  parse():Program{
    const functions=new Map<string,FunctionDeclaration>();
    const globals:Stmt[]=[];
    while(this.current().kind!=='eof'){
      const typeToken=this.eatType(true);
      const nameToken=this.eat('identifier');
      if(this.is('(')){
        if(functions.has(nameToken.value))throw new RoboError(`Duplicate function '${nameToken.value}'`,nameToken.line,nameToken.column);
        this.eat('(');
        const params:{name:string;type:ValueType}[]=[];
        if(!this.is(')')){
          do{
            const paramType=this.eatVariableType();
            const paramName=this.eat('identifier');
            if(params.some(param=>param.name===paramName.value))throw new RoboError(`Duplicate parameter '${paramName.value}'`,paramName.line,paramName.column);
            params.push({name:paramName.value,type:paramType});
          }while(this.is(',')&&this.eat(','));
        }
        this.eat(')');
        const body=this.block();
        functions.set(nameToken.value,{returnType:typeToken.value,params,body,line:typeToken.line,column:typeToken.column});
      }else{
        if(typeToken.value==='void')throw new RoboError('Variables cannot have type void',typeToken.line,typeToken.column);
        let size:number|undefined;
        let variableType=typeToken.value as ValueType;
        if(this.is('[')){this.eat('[');const sizeToken=this.eat('number');this.eat(']');size=Number(sizeToken.value);variableType=`${typeToken.value}[]` as ValueType}
        let value:Expr|undefined;
        if(this.is('=')){this.eat('=');value=this.expression()}
        this.eat(';');
        globals.push({type:'var',name:nameToken.value,varType:variableType,value,size:variableType.endsWith('[]')?(size??4):undefined,line:typeToken.line,column:typeToken.column});
      }
    }
    if(!functions.has('update'))throw new RoboError("Missing required function 'update'");
    return{functions,globals};
  }

  private block():Stmt{
    const start=this.eat('{');
    const body:Stmt[]=[];
    while(!this.is('}')){
      if(this.current().kind==='eof')throw new RoboError("Expected '}'",this.current().line,this.current().column);
      body.push(this.statement());
    }
    this.eat('}');
    return{type:'block',body,line:start.line,column:start.column};
  }

  private statement():Stmt{
    const start=this.current();
    if(this.is('if')){
      this.eat('if');
      this.eat('(');
      const test=this.expression();
      this.eat(')');
      const then=this.block();
      let elseBranch:Stmt|undefined;
      if(this.is('else')){
        this.eat('else');
        elseBranch=this.is('if')?this.statement():this.block();
      }
      return{type:'if',test,then,elseBranch,line:start.line,column:start.column};
    }
    if(this.is('return')){
      this.eat('return');
      if(this.is(';')){this.eat(';');return{type:'return',line:start.line,column:start.column}}
      const value=this.expression();
      this.eat(';');
      return{type:'return',value,line:start.line,column:start.column};
    }
    if(this.is('for')){
      this.eat('for');
      this.eat('(');
      let init:Stmt|undefined;
      if(!this.is(';'))init=this.statement();else this.eat(';');
      const test=this.expression();
      this.eat(';');
      let update:Stmt|undefined;
      if(!this.is(')')){
        const updateToken=this.current();
        const name=this.eat('identifier');
        this.eat('=');
        update={type:'assign',name:name.value,value:this.expression(),line:updateToken.line,column:updateToken.column};
      }
      this.eat(')');
      const body=this.block();
      return{type:'for',init,test,update,body,maxIterations:64,line:start.line,column:start.column};
    }
    if(this.is('int')||this.is('bool')){
      const typeToken=this.eatVariableType();
      const name=this.eat('identifier');
      let size:number|undefined;
      if(this.is('[')){this.eat('[');const sizeToken=this.eat('number');this.eat(']');size=Number(sizeToken.value)}
      let value:Expr|undefined;
      if(this.is('=')){this.eat('=');value=this.expression()}
      this.eat(';');
      return{type:'var',name:name.value,varType:typeToken,value,size:typeToken.endsWith('[]')?(size??4):undefined,line:start.line,column:start.column};
    }
    if(this.current().kind==='identifier'&&(this.tokens[this.index+1]?.value==='='||this.tokens[this.index+1]?.value==='[')){
      const name=this.eat('identifier');
      let index:Expr|undefined;
      if(this.is('[')){this.eat('[');index=this.expression();this.eat(']')}
      this.eat('=');
      const value=this.expression();
      this.eat(';');
      return{type:'assign',name:name.value,value,index,line:start.line,column:start.column};
    }
    const expr=this.expression();
    this.eat(';');
    return{type:'expr',expr,line:start.line,column:start.column};
  }

  private expression(){return this.binary(0)}
  private precedence(operator:string){return{'||':1,'&&':2,'==':3,'!=':3,'<':4,'<=':4,'>':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6}[operator]??-1}
  private binary(minimum:number):Expr{
    let left=this.unary();
    while(this.current().kind==='operator'&&this.precedence(this.current().value)>=minimum){
      const operator=this.eat('operator');
      const precedence=this.precedence(operator.value);
      const right=this.binary(precedence+1);
      left={type:'binary',op:operator.value,left,right,line:operator.line,column:operator.column};
    }
    return left;
  }
  private unary():Expr{
    if(this.is('!')||this.is('-')){
      const operator=this.eat('operator');
      return{type:'unary',op:operator.value,expr:this.unary(),line:operator.line,column:operator.column};
    }
    return this.primary();
  }
  private primary():Expr{
    const token=this.current();
    if(token.kind==='number'){
      this.eat('number');
      return{type:'literal',value:Number(token.value),line:token.line,column:token.column};
    }
    if(token.kind==='bool'){
      this.eat('bool');
      return{type:'literal',value:token.value==='true',line:token.line,column:token.column};
    }
    if(token.kind==='identifier'){
      const name=this.eat('identifier');
      if(this.is('(')){
        this.eat('(');
        const args:Expr[]=[];
        if(!this.is(')')){
          do{args.push(this.expression())}while(this.is(',')&&this.eat(','));
        }
        this.eat(')');
        return{type:'call',name:name.value,args,line:name.line,column:name.column};
      }
      if(this.is('[')){
        this.eat('[');const index=this.expression();this.eat(']');
        return{type:'array',name:name.value,index,line:name.line,column:name.column};
      }
      return{type:'variable',name:name.value,line:name.line,column:name.column};
    }
    if(this.is('(')){
      this.eat('(');
      const expression=this.expression();
      this.eat(')');
      return expression;
    }
    throw new RoboError('Expected expression',token.line,token.column);
  }
}

export interface RuntimeHost{sense(name:string):boolean;action(name:string):void}
export interface TickResult{
  variables:Record<string,RuntimeValue>;
  sensors:{name:string;value:boolean}[];
  action?:string;
  sourceLine?:number;
  error?:string;
  errorLine?:number;
  errorColumn?:number;
}

const sensorNames=new Set(['wall_ahead','enemy_ahead','low_hp','enemy_near','low_energy']);
const actionNames=new Set(['move_forward','turn_left','turn_right','wait','attack','shield','ranged_attack']);

export class Interpreter{
  globals:Record<string,RuntimeValue>={};
  private globalTypes:Record<string,ValueType>={};
  private ops=0;
  private callDepth=0;

  constructor(private program:Program,private host:RuntimeHost,private maxOps=500){
    const update=program.functions.get('update')!;
    if(update.returnType!=='void')throw new RoboError("Function 'update' must return void",update.line,update.column);
    if(update.params.length)throw new RoboError("Function 'update' cannot have parameters",update.line,update.column);
    for(const statement of program.globals){
      if(statement.type!=='var')continue;
      if(this.globalTypes[statement.name])throw new RoboError(`Duplicate global variable '${statement.name}'`,statement.line,statement.column);
      const value=statement.value?this.evaluateInitializer(statement.value):this.defaultValue(statement.varType,statement.size);
      this.assertType(value,statement.varType,statement,`Initializer for '${statement.name}'`);
      this.globalTypes[statement.name]=statement.varType;
      this.globals[statement.name]=value;
    }
  }

  runTick():TickResult{
    this.ops=0;
    const sensors:{name:string;value:boolean}[]=[];
    let action:string|undefined;
    let sourceLine:number|undefined;
    const env:Record<string,RuntimeValue>={...this.globals};
    const types:Record<string,ValueType>={...this.globalTypes};

    const evaluate=(expression:Expr):RuntimeValue|undefined=>{
      this.consumeOperation(expression);
      switch(expression.type){
        case'literal':return expression.value;
        case'variable':
          if(!Object.prototype.hasOwnProperty.call(env,expression.name))this.fail(`Undefined variable '${expression.name}'`,expression);
          return env[expression.name];
        case'array':{
          const array=env[expression.name];
          if(!array||typeof array!=='object'||array.kind!=='array')this.fail(`Variable '${expression.name}' is not an array`,expression);
          const index=evaluate(expression.index);
          this.assertType(index,'int',expression.index,'Array index');
          const numericIndex=index as number;
          if(numericIndex<0||numericIndex>=array.values.length)this.fail(`Array index ${numericIndex} out of bounds`,expression.index);
          return array.values[numericIndex];
        }
        case'unary':{
          const value=evaluate(expression.expr);
          if(expression.op==='!'){
            this.assertType(value,'bool',expression,"Operator '!'");
            return!value;
          }
          this.assertType(value,'int',expression,"Unary '-'");
          return-(value as number);
        }
        case'binary':{
          const left=evaluate(expression.left);
          if(expression.op==='&&'||expression.op==='||'){
            this.assertType(left,'bool',expression.left,`Operator '${expression.op}'`);
            if(expression.op==='&&'&&left===false)return false;
            if(expression.op==='||'&&left===true)return true;
            const right=evaluate(expression.right);
            this.assertType(right,'bool',expression.right,`Operator '${expression.op}'`);
            return expression.op==='&&'?(left as boolean)&&(right as boolean):(left as boolean)||(right as boolean);
          }
          const right=evaluate(expression.right);
          if(expression.op==='=='||expression.op==='!='){
            if(this.valueType(left)!==this.valueType(right))this.fail(`Operator '${expression.op}' requires matching operand types`,expression);
            return expression.op==='=='?left===right:left!==right;
          }
          this.assertType(left,'int',expression.left,`Operator '${expression.op}'`);
          this.assertType(right,'int',expression.right,`Operator '${expression.op}'`);
          const a=left as number;
          const b=right as number;
          switch(expression.op){
            case'+':return a+b;
            case'-':return a-b;
            case'*':return a*b;
            case'/':if(b===0)this.fail('Division by zero',expression);return Math.trunc(a/b);
            case'%':if(b===0)this.fail('Modulo by zero',expression);return a%b;
            case'<':return a<b;
            case'<=':return a<=b;
            case'>':return a>b;
            case'>=':return a>=b;
            default:return this.fail(`Unknown operator '${expression.op}'`,expression);
          }
        }
        case'call':
          const userFunction=this.program.functions.get(expression.name);
          if(userFunction&&expression.name!=='update'){
            if(expression.args.length!==userFunction.params.length)this.fail(`Function '${expression.name}' expects ${userFunction.params.length} arguments`,expression);
            if(++this.callDepth>32)this.fail('Call depth limit exceeded',expression);
            const savedEnv={...env};
            const savedTypes={...types};
            const args=expression.args.map(arg=>evaluate(arg));
            for(let index=0;index<userFunction.params.length;index++){
              const parameter=userFunction.params[index];
              this.assertType(args[index],parameter.type,expression,`Argument '${parameter.name}'`);
              env[parameter.name]=args[index]!;
              types[parameter.name]=parameter.type;
            }
            execute(userFunction.body);
            const value=returnedValues[this.callDepth];
            this.callDepth--;
            for(const name of Object.keys(this.globalTypes))this.globals[name]=env[name]!;
            for(const key of Object.keys(env))delete env[key];
            Object.assign(env,savedEnv);
            for(const key of Object.keys(types))delete types[key];
            Object.assign(types,savedTypes);
            for(const name of Object.keys(this.globalTypes)){env[name]=this.globals[name];types[name]=this.globalTypes[name]}
            if(userFunction.returnType==='void'&&value!==undefined)this.fail(`Void function '${expression.name}' cannot return a value`,expression);
            if(userFunction.returnType!=='void')this.assertType(value,userFunction.returnType,expression,`Function '${expression.name}' return`);
            return userFunction.returnType==='void'?undefined:value;
          }
          if(expression.args.length)this.fail(`Function '${expression.name}' expects 0 arguments`,expression);
          if(sensorNames.has(expression.name)){
            const value=this.host.sense(expression.name);
            sensors.push({name:expression.name,value});
            return value;
          }
          if(actionNames.has(expression.name)){
            if(!action){action=expression.name;sourceLine=expression.line;this.host.action(expression.name)}
            return undefined;
          }
          return this.fail(`Unknown function '${expression.name}'`,expression);
      }
    };

    const returnedValues:(RuntimeValue|undefined)[]=[];
    const execute=(statement:Stmt):boolean=>{
      this.consumeOperation(statement);
      switch(statement.type){
        case'block':
          for(const child of statement.body)if(execute(child))return true;
          return false;
        case'if':{
          const condition=evaluate(statement.test);
          this.assertType(condition,'bool',statement.test,'If condition');
          return condition?execute(statement.then):(statement.elseBranch?execute(statement.elseBranch):false);
        }
        case'for':{
          if(statement.init)execute(statement.init);
          for(let iteration=0;iteration<statement.maxIterations;iteration++){
            const condition=evaluate(statement.test);
            this.assertType(condition,'bool',statement.test,'For condition');
            if(!condition)break;
            if(execute(statement.body))return true;
            if(statement.update)execute(statement.update);
          }
          return false;
        }
        case'expr':evaluate(statement.expr);return false;
        case'var':{
          if(types[statement.name])this.fail(`Variable '${statement.name}' is already declared`,statement);
          const value=statement.value?evaluate(statement.value):this.defaultValue(statement.varType,statement.size);
          this.assertType(value,statement.varType,statement,`Initializer for '${statement.name}'`);
          types[statement.name]=statement.varType;
          env[statement.name]=value;
          return false;
        }
        case'assign':{
          if(!types[statement.name])this.fail(`Assignment to undefined variable '${statement.name}'`,statement);
          const value=evaluate(statement.value);
          if(statement.index){
            const array=env[statement.name];
            if(!array||typeof array!=='object'||array.kind!=='array')this.fail(`Variable '${statement.name}' is not an array`,statement);
            const index=evaluate(statement.index);
            this.assertType(index,'int',statement.index,'Array index');
            const numericIndex=index as number;
            if(numericIndex<0||numericIndex>=array.values.length)this.fail(`Array index ${numericIndex} out of bounds`,statement.index);
            this.assertType(value,array.elementType,statement,`Assignment to '${statement.name}'`);
            array.values[numericIndex]=value;
          }else{
            this.assertType(value,types[statement.name],statement,`Assignment to '${statement.name}'`);
            env[statement.name]=value;
          }
          return false;
        }
        case'return':
          if(this.callDepth===0&&statement.value)this.fail("Void function 'update' cannot return a value",statement);
          if(statement.value)returnedValues[this.callDepth]=evaluate(statement.value);
          return true;
      }
    };

    try{
      execute(this.program.functions.get('update')!.body);
      for(const name of Object.keys(this.globalTypes))this.globals[name]=env[name];
      return{variables:{...env},sensors,action,sourceLine};
    }catch(error){
      const runtimeError=error instanceof RoboError?error:new RoboError(error instanceof Error?error.message:String(error));
      return{variables:{...env},sensors,action,sourceLine,error:`Runtime error ${runtimeError.line}:${runtimeError.column} - ${runtimeError.message}`,errorLine:runtimeError.line,errorColumn:runtimeError.column};
    }
  }

  private evaluateInitializer(expression:Expr):RuntimeValue{
    switch(expression.type){
      case'literal':return expression.value;
      case'variable':
        if(!Object.prototype.hasOwnProperty.call(this.globals,expression.name))return this.fail(`Undefined variable '${expression.name}'`,expression);
        return this.globals[expression.name];
      case'unary':{
        const value=this.evaluateInitializer(expression.expr);
        if(expression.op==='!'){this.assertType(value,'bool',expression,"Operator '!'");return!value}
        this.assertType(value,'int',expression,"Unary '-'");return-(value as number);
      }
      case'binary':{
        const left=this.evaluateInitializer(expression.left);
        const right=this.evaluateInitializer(expression.right);
        if(expression.op==='=='||expression.op==='!='){
          if(this.valueType(left)!==this.valueType(right))return this.fail(`Operator '${expression.op}' requires matching operand types`,expression);
          return expression.op==='=='?left===right:left!==right;
        }
        if(expression.op==='&&'||expression.op==='||'){
          this.assertType(left,'bool',expression.left,`Operator '${expression.op}'`);
          this.assertType(right,'bool',expression.right,`Operator '${expression.op}'`);
          return expression.op==='&&'?(left as boolean)&&(right as boolean):(left as boolean)||(right as boolean);
        }
        this.assertType(left,'int',expression.left,`Operator '${expression.op}'`);
        this.assertType(right,'int',expression.right,`Operator '${expression.op}'`);
        const a=left as number;
        const b=right as number;
        switch(expression.op){
          case'+':return a+b;case'-':return a-b;case'*':return a*b;
          case'/':if(b===0)return this.fail('Division by zero',expression);return Math.trunc(a/b);
          case'%':if(b===0)return this.fail('Modulo by zero',expression);return a%b;
          case'<':return a<b;case'<=':return a<=b;case'>':return a>b;case'>=':return a>=b;
          default:return this.fail(`Unknown operator '${expression.op}'`,expression);
        }
      }
      case'call':return this.fail('Global initializers cannot call functions',expression);
      case'array':return this.fail('Global initializers cannot read arrays',expression);
    }
  }

  private defaultValue(type:ValueType,size=4):RuntimeValue{if(type==='bool')return false;if(type==='int')return 0;return{kind:'array',elementType:type==='bool[]'?'bool':'int',values:Array.from({length:Math.max(1,Math.min(32,size))},()=>type==='bool[]'?false:0)}}
  private valueType(value:RuntimeValue|undefined):ValueType|'void'{if(typeof value==='boolean')return'bool';if(typeof value==='number')return'int';if(value&&typeof value==='object'&&value.kind==='array')return value.elementType==='bool'?'bool[]':'int[]';return'void'}
  private assertType(value:RuntimeValue|undefined,expected:ValueType,node:SourceNode,context:string):asserts value is RuntimeValue{
    const actual=this.valueType(value);
    if(actual!==expected)this.fail(`${context} requires ${expected}, received ${actual}`,node);
  }
  private consumeOperation(node:SourceNode){if(++this.ops>this.maxOps)this.fail('Execution limit exceeded',node)}
  private fail(message:string,node:SourceNode):never{throw new RoboError(message,node.line??1,node.column??1)}
}
