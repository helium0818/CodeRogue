import { describe, it, expect } from 'vitest';
import { lex, Parser, Interpreter, RoboError } from '../src/language';

describe('RoboC++', () => {
  it('lexes and parses update', () => {
    const p = new Parser(lex('void update(){ if (wall_ahead()) { turn_right(); } else { move_forward(); } }')).parse();
    expect(p.functions.has('update')).toBe(true);
  });
  it('commits one action per tick', () => {
    const p = new Parser(lex('void update(){ move_forward(); turn_right(); }')).parse();
    const actions: string[] = []; const i = new Interpreter(p, { sense: () => false, action: a => actions.push(a) });
    const result = i.runTick(); expect(actions).toEqual(['move_forward']); expect(result.sourceLine).toBe(1);
  });
  it('persists variables', () => {
    const p = new Parser(lex('int n=0; void update(){ n=n+1; wait(); }')).parse();
    const i = new Interpreter(p, { sense: () => false, action: () => {} });
    expect(i.runTick().variables.n).toBe(1); expect(i.runTick().variables.n).toBe(2);
  });
  it('reports the committed action source line for editor highlighting', () => {
    const source = `void update() {
  if (enemy_ahead()) {
    attack();
  } else {
    move_forward();
  }
}`;
    const p = new Parser(lex(source)).parse();
    const attacking = new Interpreter(p, {sense:name=>name==='enemy_ahead',action:()=>{}});
    const moving = new Interpreter(p, {sense:()=>false,action:()=>{}});
    expect(attacking.runTick().sourceLine).toBe(3);
    expect(moving.runTick().sourceLine).toBe(5);
  });
  it('reports undefined variables, invalid conditions, and division by zero with source locations', () => {
    const cases = [
      ['void update(){\n  missing = 1;\n}',"Assignment to undefined variable 'missing'",2],
      ['void update(){\n  if (1) { wait(); }\n}','If condition requires bool, received int',2],
      ['int n=1; void update(){\n  n = n / 0;\n}','Division by zero',2]
    ] as const;
    for(const [source,message,line] of cases){
      const interpreter = new Interpreter(new Parser(lex(source)).parse(),{sense:()=>false,action:()=>{}});
      const result = interpreter.runTick();
      expect(result.error).toContain(message);
      expect(result.errorLine).toBe(line);
      expect(result.errorColumn).toBeGreaterThan(0);
    }
  });
  it('enforces declared types and builtin argument counts', () => {
    const typeMismatch = new Interpreter(new Parser(lex('bool ready=false; void update(){ ready=1; }')).parse(),{sense:()=>false,action:()=>{}}).runTick();
    expect(typeMismatch.error).toContain("Assignment to 'ready' requires bool, received int");
    const badArguments = new Interpreter(new Parser(lex('void update(){ move_forward(1); }')).parse(),{sense:()=>false,action:()=>{}}).runTick();
    expect(badArguments.error).toContain("Function 'move_forward' expects 0 arguments");
    expect(()=>new Interpreter(new Parser(lex('bool enabled=1; void update(){ wait(); }')).parse(),{sense:()=>false,action:()=>{}})).toThrow(RoboError);
  });
  it('resets local variables each tick while preserving globals', () => {
    const source='int total=0; void update(){ int local=0; local=local+1; total=total+1; wait(); }';
    const interpreter = new Interpreter(new Parser(lex(source)).parse(),{sense:()=>false,action:()=>{}});
    const first = interpreter.runTick();
    const second = interpreter.runTick();
    expect(first.variables).toMatchObject({local:1,total:1});
    expect(second.variables).toMatchObject({local:1,total:2});
    expect(interpreter.globals).toEqual({total:2});
  });
  it('uses boolean short-circuiting without evaluating an unreachable invalid branch', () => {
    const source='void update(){ if(false && missing > 0){ attack(); } else { wait(); } }';
    const result = new Interpreter(new Parser(lex(source)).parse(),{sense:()=>false,action:()=>{}}).runTick();
    expect(result.error).toBeUndefined();
    expect(result.action).toBe('wait');
  });
  it('executes bounded for loops and preserves global state', () => {
    const source='int n=0; void update(){ for(int i=0; i<3; i=i+1){ n=n+1; } wait(); }';
    const interpreter=new Interpreter(new Parser(lex(source)).parse(),{sense:()=>false,action:()=>{}});
    expect(interpreter.runTick().variables.n).toBe(3);
    expect(interpreter.runTick().variables.n).toBe(6);
  });
  it('supports user-defined void helpers and guards recursive call depth', () => {
    const source='void step(){ move_forward(); } void update(){ step(); }';
    const actions:string[]=[];
    const interpreter=new Interpreter(new Parser(lex(source)).parse(),{sense:()=>false,action:a=>actions.push(a)});
    expect(interpreter.runTick().action).toBe('move_forward');
    expect(actions).toEqual(['move_forward']);
    const recursive='void loop(){ loop(); } void update(){ loop(); }';
    const result=new Interpreter(new Parser(lex(recursive)).parse(),{sense:()=>false,action:()=>{}}).runTick();
    expect(result.error).toContain('Call depth limit exceeded');
  });
  it('supports fixed-size arrays with bounds and element type checks', () => {
    const source='int cells[3]; void update(){ cells[1]=4; wait(); }';
    const interpreter=new Interpreter(new Parser(lex(source)).parse(),{sense:()=>false,action:()=>{}});
    expect(interpreter.runTick().variables.cells).toMatchObject({kind:'array',values:[0,4,0]});
    const outOfBounds=new Interpreter(new Parser(lex('int cells[2]; void update(){ cells[2]=1; }')).parse(),{sense:()=>false,action:()=>{}}).runTick();
    expect(outOfBounds.error).toContain('out of bounds');
  });
});
