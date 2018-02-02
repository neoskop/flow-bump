/// <reference path="./definitions.d.ts" />
import * as Listr from 'listr';
import * as fs from 'fs-extra';
import * as path from 'path';
import { switchMap } from 'rxjs/operators';
import { _throw } from 'rxjs/observable/throw'
import * as semver from 'semver';
import { empty } from 'rxjs/observable/empty';
import { concat } from 'rxjs/observable/concat';
import { git } from './lib/cmd';
import { handleConflictError, mainVersion, readPkgIntoContext } from './lib/utils';



export interface IOptions {
    commitMessage: string;
    pull: boolean;
    push: boolean;
    keepBranch: boolean;
    tagBranch: boolean;
}

export interface IPrefix {
    release: string;
    hotfix: string;
    versiontag: string;
}

export interface IBranch {
    master: string;
    develop: string;
}


export async function flowBump(version : string, options : IOptions & {
    branch?: string,
    tag?: string,
    type?: 'release' | 'hotfix'
}, prefix: IPrefix, branch : IBranch) {
    options = {
        ...options
    };
    const PKG_FILE = path.join(process.cwd(), 'package.json');
    
    if(semver.valid(version) && !options.type) {
        throw new Error('Must provide type when providing extact version');
    }
    
    const tasks = new Listr<{
        pkg?: { version: string };
        version?: semver.SemVer;
    }>([]);
    
    let fromBranch : string|undefined;
    let fromTag : string|undefined;
    if(options.branch) {
        fromBranch = options.branch;
    } else if(!options.tag) {
        if(version === 'hotfix') {
            fromBranch = branch.master;
        } else if(version === 'patch' || version === 'minor' || version === 'major') {
            fromBranch = branch.develop;
        }
    } else if(options.tag) {
        fromTag = options.tag;
    }
    
    
    if(fromTag) {
        if(options.pull) {
            tasks.add({
                title: 'Git fetch',
                task : () => git.fetch(['--all', '--tags'])
            });
            
            tasks.add({
                title: 'Read package.json',
                task: (ctx : any) => {
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
        }
    } else {
        if(fromBranch) {
            tasks.add({
                title: `Checkout branch ${fromBranch}`,
                task: () => git.checkout(fromBranch!)
            });
        }
        if(options.pull) {
            tasks.add({
                title: `Git pull`,
                task: () => git.pull()
            })
        }
        
        tasks.add({
            title: 'Read package.json',
            task: (ctx : any) => readPkgIntoContext(PKG_FILE, ctx)
        });
    }
    
    tasks.add({
        title: 'Resolve new version',
        task: (ctx : any, task : any) => {
            let v = ctx.pkg ? semver.parse(ctx.pkg.version)! : null;
            if('major' === version || 'minor' === version || 'patch' === version) {
                v = v!.inc(version);
                v.prerelease = [ 'pre' ];
            }
            if('hotfix' === version) {
                v = v!.inc('patch');
                v.prerelease = [ 'pre' ];
            }
            if('alpha' === version || 'beta' === version || 'rc' === version) {
                v = v!.inc('prerelease', version);
            }
            if('final' === version) {
                v!.prerelease.length = 0;
            }
            if(semver.valid(version)) {
                v = semver.parse(version)!;
                v.prerelease = [ 'pre' ];
            }
            ctx.version = v;
            task.title += ` to ${v!.format()}`;
        }
    });
    
    
    if(version === 'patch' || version === 'minor' || version === 'major' || (semver.valid(version) && options.type === 'release')) {
        tasks.add({
            title: 'Git flow start release',
            task: (ctx : any) => fromTag ?
                git.createBranch( prefix.release + mainVersion(ctx.version), { fromTag: fromTag }) :
                git.createBranch( prefix.release + mainVersion(ctx.version))
        });
    } else if(version === 'hotfix' || (semver.valid(version) && options.type === 'hotfix')) {
        tasks.add({
            title: 'Git flow start hotfix',
            task: (ctx : any) => fromTag ?
                git.createBranch( prefix.hotfix + mainVersion(ctx.version), { fromTag: fromTag }) :
                git.createBranch( prefix.hotfix + mainVersion(ctx.version))
                
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
        task: (ctx : any) => new Listr([
            {
                title: 'update package.json',
                task: async (ctx : any, task: any) => {
                    ctx.pkg.version = ctx.version.format();
                    task.title += ` to ${ctx.pkg.version}`;
                    await fs.writeFile(PKG_FILE, JSON.stringify(ctx.pkg, null, 2));
                }
            },
            {
                title: 'add package.json',
                task: () => git('add', 'package.json')
            },
            {
                title: 'commit package.json',
                task: () => git.commit(options.commitMessage.replace(/%VERSION%/g, ctx.version.format()))
            },
            ...('final' !== version || options.tagBranch ? [
                {
                    title: 'Tag commit',
                    task : () => git.currentBranch().pipe(
                        switchMap(branchName => git.tag(prefix.versiontag + ctx.version.format(), branchName))
                    )
                }
            ] : [])
        ])
    });
    
    if(options.push) {
        tasks.add({
            title: 'Push branch',
            task: () => git.currentBranch().pipe(
                switchMap(branch => git.push('origin', branch))
            )
        });
    }
    
    if(version === 'final') {
        tasks.add({
            title: 'Git finish',
            task: (ctx : any, task : any) => git.currentBranch().pipe(
                switchMap((branchName : string) => {
                    const isHotfix = branchName.indexOf(prefix.hotfix) === 0;
                    const isRelease = branchName.indexOf(prefix.release) === 0;
                    
                    if(!isHotfix && !isRelease) {
                        return _throw(new Error(`Invalid branch: "${branchName}"`));
                    }
                    
                    return concat(
                        git.checkout(branch.master),
                        git.merge(branchName, [ '--no-edit' ]).pipe(handleConflictError(task)),
                        options.tagBranch ? empty() : git.tag( prefix.versiontag + ctx.version.format(), branchName),
                        git.checkout(branch.develop),
                        git.merge(branchName, [ '--no-edit' ]).pipe(handleConflictError(task)),
                        options.keepBranch ? empty() : git.removeBranch(branchName)
                    );
                })
            )
        });
        
        if(options.push) {
            tasks.add({
                title: 'Push develop branch',
                task: () => concat(
                    git.checkout(branch.develop),
                    git.push('origin', branch.develop)
                )
            });
    
            tasks.add({
                title: `Push master branch`,
                task: () => concat(
                    git.checkout(branch.master),
                    git.push('origin', branch.master)
                )
            });
        }
    }
    
    return await tasks.run();
}

process.on('unhandledRejection', (reason) => {
    console.log('unhandledRejection: ' + reason.stack);
});
