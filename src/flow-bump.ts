import * as Listr from 'listr';
import * as fs from 'fs-extra';
import * as path from 'path';
import { switchMap } from 'rxjs/operators';
import { _throw } from 'rxjs/observable/throw'
import * as semver from 'semver';
import { empty } from 'rxjs/observable/empty';
import { concat } from 'rxjs/observable/concat';
import { git, invokeScript } from './lib/cmd';
import { handleConflictError, mainVersion, readPkgIntoContext } from './lib/utils';
import { fromPromise } from 'rxjs/observable/fromPromise';
import { IOptions, IPrefix, IBranch, IScripts } from './types';

export type MainCommand = 'major'|'minor'|'patch'|'fix';
export type IncCommand = 'alpha'|'beta'|'rc';
export type SpecCommand = 'release'|'hotfix';
export type FinalCommand = 'final';
export type Command = MainCommand|IncCommand|SpecCommand|FinalCommand;

export async function flowBump(command : Command, options : IOptions & {
    fromBranch?: string,
    fromTag?: string,
    oneShot: boolean,
    version?: string,
    type: 'alpha' | 'beta' | 'rc' | 'pre'
}, prefix: IPrefix, branch : IBranch, scripts? : IScripts) {
    options = {
        ...options
    };
    const PKG_FILE = path.join(process.cwd(), 'package.json');
    
    const tasks = new Listr<{
        pkg?: { version: string };
        version?: semver.SemVer;
    }>([]);
    
    let fromBranch : string|undefined;
    let fromTag : string|undefined;
    if(options.fromBranch) {
        fromBranch = options.fromBranch;
    } else if(!options.fromTag) {
        if(command === 'hotfix' || command === 'fix') {
            fromBranch = branch.master;
        } else if(command === 'patch' || command === 'minor' || command === 'major') {
            fromBranch = branch.develop;
        }
    } else if(options.fromTag) {
        fromTag = options.fromTag;
    }
    
    
    if(fromTag) {
        tasks.add({
            title: 'Git fetch',
            skip: () => !options.pull,
            task : () => git.fetch(['--all', '--tags'])
        });
    
        tasks.add({
            title: 'Read package.json',
            task: ctx => {
                const TMP_BRANCH_NAME = 'temp/' + Math.random().toString(36).substr(2, 32);
                return git.currentBranch().pipe(
                    switchMap(branch => {
                        return concat(
                            git.createBranch(TMP_BRANCH_NAME, { fromTag }),
                            readPkgIntoContext(PKG_FILE, ctx),
                            git.checkout(branch),
                            git.removeBranch(TMP_BRANCH_NAME)
                        )
                    })
                );
            }
        })
    } else {
        if(fromBranch) {
            tasks.add({
                title: `Checkout branch ${fromBranch}`,
                task: () => git.checkout(fromBranch!)
            });
        }
        
        tasks.add({
            title: `Git pull`,
            skip: () => !options.pull,
            task: () => concat(
                invokeScript('prePull', { scripts }),
                git.pull(),
                invokeScript('postPull', { scripts })
            )
        });
        
        tasks.add({
            title: 'Read package.json',
            task: ctx => readPkgIntoContext(PKG_FILE, ctx)
        });
    }
    
    tasks.add({
        title: 'Resolve new version',
        task: (ctx, task) => {
            let v = ctx.pkg ? semver.parse(ctx.pkg.version)! : null;
            if('major' === command || 'minor' === command || 'patch' === command) {
                v = v!.inc(command);
                v.prerelease = [ 'pre' ];
                if(options.type && options.type !== 'pre') {
                    v = v!.inc('prerelease', options.type);
                }
            }
            if('fix' === command) {
                v = v!.inc('patch');
                v.prerelease = [ 'pre' ];
                if(options.type && options.type !== 'pre') {
                    v = v!.inc('prerelease', options.type);
                }
            }
            if('alpha' === command || 'beta' === command || 'rc' === command) {
                v = v!.inc('prerelease', command);
            }
            if('hotfix' === command || 'release' === command) {
                v = semver.parse(options.version!)!;
                v.prerelease = [ 'pre' ];
                if(options.type && options.type !== 'pre') {
                    v = v!.inc('prerelease', options.type);
                }
            }
            if('final' === command || options.oneShot) {
                v!.prerelease.length = 0;
            }
            ctx.version = v!;
            task.title += ` to ${ctx.version.format()}`;
        }
    });
    
    
    if(command === 'patch' || command === 'minor' || command === 'major' || command === 'release') {
        tasks.add({
            title: 'Git flow start release',
            task: ctx => fromTag ?
                git.createBranch( prefix.release + mainVersion(ctx.version!), { fromTag: fromTag }) :
                git.createBranch( prefix.release + mainVersion(ctx.version!))
        });
    } else if(command === 'hotfix' || command === 'fix') {
        tasks.add({
            title: 'Git flow start hotfix',
            task: ctx => fromTag ?
                git.createBranch( prefix.hotfix + mainVersion(ctx.version!), { fromTag: fromTag }) :
                git.createBranch( prefix.hotfix + mainVersion(ctx.version!))
                
        });
    } else {
        tasks.add({
            title: 'Check current branch',
            task: () => git.currentBranch().pipe(
                switchMap(branch => {
                    const isHotfix = branch.indexOf(prefix.hotfix) === 0;
                    const isRelease = branch.indexOf(prefix.release) === 0;
    
                    if(!isHotfix && !isRelease) {
                        return _throw(new Error(`Invalid branch: "${branch}"`));
                    }
                    
                    return empty();
                })
            )
        })
    }
    
    tasks.add({
        title: 'bump version',
        task: (ctx, task) => {
            ctx.pkg!.version = ctx.version!.format();
            task.title += ` to ${ctx.pkg!.version}`;
            return concat(
                invokeScript('preBump', { scripts }, ctx),
                fromPromise(fs.writeFile(PKG_FILE, JSON.stringify(ctx.pkg, null, 2))),
                git('add', 'package.json'),
                git.commit(options.commitMessage.replace(/%VERSION%/g, ctx.version!.format())),
                (options.oneShot || 'final' === command) && !options.tagBranch ? empty() : git.currentBranch().pipe(
                    switchMap(branchName => concat(
                        git.tag(prefix.versiontag + ctx.version!.format(), branchName),
                        invokeScript('postBump', { scripts, env: { FB_BRANCH: branchName } }, ctx)
                    ))
                )
            )
        }
    });
    
    tasks.add({
        title: 'Push branch',
        skip: () => !options.push,
        task: ctx => concat(
            git.currentBranch().pipe(
                switchMap(branch => concat(
                    invokeScript('prePush', { scripts, env: { FB_BRANCH: branch } }, ctx),
                    git.push('origin', branch),
                    invokeScript('postPush', { scripts, env: { FB_BRANCH: branch } }, ctx)
                ))
            )
        )
    });
    
    if(command === 'final' || options.oneShot) {
        tasks.add({
            title: 'Git finish',
            task: (ctx, task) => git.currentBranch().pipe(
                switchMap((branchName : string) => {
                    const isHotfix = branchName.indexOf(prefix.hotfix) === 0;
                    const isRelease = branchName.indexOf(prefix.release) === 0;
                    
                    if(!isHotfix && !isRelease) {
                        return _throw(new Error(`Invalid branch: "${branchName}"`));
                    }
                    
                    return concat(
                        git.checkout(branch.master),
                        git.merge(branchName, [ '--no-edit' ]).pipe(handleConflictError(task)),
                        options.tagBranch ? empty() : git.tag( prefix.versiontag + ctx.version!.format(), branch.master),
                        git.checkout(branch.develop),
                        git.merge(branchName, [ '--no-edit' ]).pipe(handleConflictError(task)),
                        options.keepBranch ? empty() : git.removeBranch(branchName)
                    );
                })
            )
        });
        
        tasks.add({
            title: 'Push develop branch',
            skip: () => !options.push,
            task: ctx => concat(
                git.checkout(branch.develop),
                invokeScript('prePush', { scripts, env: { FB_BRANCH: branch.develop } }, ctx),
                git.push('origin', branch.develop),
                invokeScript('postPush', { scripts, env: { FB_BRANCH: branch.develop } }, ctx)
            )
        });

        tasks.add({
            title: `Push master branch`,
            skip: () => !options.push,
            task: ctx => concat(
                git.checkout(branch.master),
                invokeScript('prePush', { scripts, env: { FB_BRANCH: branch.master } }, ctx),
                git.push('origin', branch.master),
                invokeScript('postPush', { scripts, env: { FB_BRANCH: branch.master } }, ctx),
            )
        });
    }
    
    return await tasks.run();
}

process.on('unhandledRejection', (reason) => {
    console.log('unhandledRejection: ' + reason.stack);
});
