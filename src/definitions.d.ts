declare module "listr" {
    import { Observable } from 'rxjs/Observable';
    
    class Listr<C extends Listr.Context>{
        public context : C;
        public task : Listr.ITask<C>[];
        constructor(tasks : Listr.ITaskDefinition<C>[], options?: Listr.IOptions);
        add(task : List.ITaskDefinition<C>) : Listr.ITask<C>;
        run(ctx?: C) : Promise<C>;
    }
    
    module Listr {
        export type Context = {};
        
        export interface IOptions {
            concurrent?: number|boolean;
            exitOnError?: boolean;
            renderer?: 'default'|'versobe'|'silent'|object;
            nonTTYRenderer?: string|object;
        }
        
        export interface ITaskDefinition<C extends Context> {
            title: string;
            task: (ctx : C, task : ITask<C>) => void | any | Promise<any> | Observable<any> | Listr<any>;
            skip?: (ctx : C) => void|string|boolean;
        }
        
        export interface ITask<C extends Context> extends ITaskDefinition<C> {
            skip(reason?: string) : void;
            output?: string;
        }
    }
    
    export = Listr;
}

declare module "stream-to-observable" {
    import { Observable } from 'rxjs/Observable';
    
    const streamToObservable : (stream : ReadableStream, options?: { await : any }) => Observable<any>;
    
    export = streamToObservable;
}

declare module "split" {
    const split : () => any;
    
    export = split;
}
