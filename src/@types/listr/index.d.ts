declare module "listr" {
    import { Observable } from 'rxjs/Observable';
    
    class Listr<C extends Listr.Context>{
        public context : C;
        public task : Listr.ITask<C>[];
        constructor(tasks : Listr.ITaskDefinition<C>[], options?: Listr.IOptions);
        add(task : Listr.ITaskDefinition<C>) : Listr.ITask<C>;
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
            enabled?: (ctx : C) => boolean;
        }
        
        export interface ITask<C extends Context> {
            title: string;
            output?: string;
            skip(reason?: string) : void;
        }
    }
    
    export = Listr;
}
