import 'source-map-support/register';
import 'colors';
import * as yargs from 'yargs';
import { flowBump } from './flow-bump';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as YAML from 'yamljs';
import * as ini from 'ini';
import { IBranch, IOptions, IPrefix, IScripts } from './types';
import { DEFAULT_BRANCH, DEFAULT_OPTIONS, DEFAULT_PREFIX } from './lib/defaults';
import * as Path from 'object-path';
import * as os from 'os';
import { Command } from './consts';

export async function cli() {
    yargs.option('pull', {
        describe: "Pull from git before branching and bumping (via --no-pull)"
    });
    
    yargs.option('push', {
        describe: "Push to git after branching and bumping (via --no-push)"
    });
    
    yargs.options('from-branch', {
        alias   : 'b',
        describe: 'Create version from which branch',
        type    : 'string'
    });
    
    yargs.options('from-tag', {
        alias   : 't',
        describe: 'Create version from which tag',
        type    : 'string'
    });
    
    yargs.options('from-commit', {
        alias   : 'c',
        describe: 'Create version from which commit',
        type    : 'string'
    });
    
    yargs.option('commit-msg', {
        alias   : 'm',
        describe: 'Template for commit message',
        type    : 'string'
    });
    
    yargs.options('keep-branch', {
        alias   : 'k',
        describe: 'Keep branch after git flow finish release',
        type    : 'boolean'
    });
    
    yargs.options('one-shot', {
        alias   : 'o',
        describe: 'Create and finalize version in one step',
        type    : 'boolean'
    });
    
    yargs.options('target', {
        alias: 'T',
        describe: 'Merge into given branch, "master", Major- or Minor-version',
    });
    
    yargs.options('tag-branch', {
        describe: 'Tag branch instead of master for final'
    });
    
    yargs.command('config', 'Manipulate config files', argv => {
        return argv
            .options('global', {
                alias   : 'g',
                describe: 'Use global configuration file in home directory',
                type    : 'boolean'
            })
            .command('get [key]', 'Display value from config', a => a, async args => {
                const [ file, config ] = await loadYamlConfig({ noLocal: args.global, noGlobal: !args.global });
                if(null == file) {
                    console.error('No config file!');
                    process.exit(2);
                }
                console.error('from', file);
                console.error();
                
                const value = Path.get(config, args.key);
                console.log(YAML.stringify(value));
            })
            .command('set <key> <value>', 'Set value in config', a => a, async args => {
                const [ , config ] = await loadYamlConfig({ noLocal: args.global, noGlobal: !args.global });
                
                
                let value : any;
                try {
                    value = JSON.parse(args.value);
                } catch {
                    value = args.value;
                }
                
                Path.set(config, args.key, value);
                
                const file = await writeYamlConfig(args.global ? 'global' : 'local', config);
                console.error('write', file);
            })
            .command('del <key>', 'Delete value from config', a => a, async args => {
                const [ , config ] = await loadYamlConfig({ noLocal: args.global, noGlobal: !args.global });
                
                
                Path.del(config, args.key);
                
                const file = await writeYamlConfig(args.global ? 'global' : 'local', config);
                console.error('write', file);
            })
            .demandCommand(1)
    });
    
    for(const version of [ 'major', 'minor', 'patch', 'hotfix' ]) {
        yargs.command(`${version} [type]`, `Create a ${version} version and branch`, argv => {
            return argv.positional('type', {
                describe: 'Prerelease version to start with (alpha|beta|rc|pre)'
            })
        })
    }
    
    for(const version of [ 'alpha', 'beta', 'rc' ]) {
        yargs.command(`${version}`, `Increase a${'alpha' === version ? 'n' : ''} ${version} version`, argv => argv)
    }
    
    yargs.command('final [target]', 'Finalize a version', argv => {
        return argv.positional('target', {
            describe: 'Merge into given branch, "master", Major- or Minor-version',
            default: 'master'
        })
    });
    
    yargs.demandCommand(1);
    
    const args = yargs.parse();
    
    if(args._[ 0 ] === 'config') {
        return;
    }
    
    if(!/^(major|minor|patch|alpha|beta|rc|hotfix|final)$/.test(args._[ 0 ])) {
        yargs.showHelp();
        process.exit();
    }
    
    try {
        
        const { prefix, branch, options, scripts } = await load(args);
        
        if((args.fromBranch && args.fromTag) || (args.fromBranch && args.fromCommit) || (args.fromTag && args.fromCommit)) {
            yargs.showHelp();
            process.exit();
        }
        
        await flowBump(args._[ 0 ] as Command, {
            ...options,
            version   : args.semver,
            fromBranch: args.fromBranch,
            fromTag   : args.fromTag,
            fromCommit: args.fromCommit,
            type      : args.type,
            oneShot   : args.oneShot,
            toBranch  : args.target
        }, prefix, branch, scripts);
        
        process.exit(0);
    } catch(err) {
        console.error(`\u274C An error occured`.red);
        console.error();
        console.error(err.message || err);
        process.exit(1);
    }
}

async function loadYamlConfig({ noLocal, noGlobal, noParent } : { noLocal? : boolean, noGlobal? : boolean, noParent? : boolean } = {}) : Promise<[ string | null, { options? : Partial<IOptions>, prefix? : Partial<IPrefix>, branch? : Partial<IBranch>, scripts? : IScripts } ]> {
    const FILE_NAMES = [ 'flow-bump.yml', 'flow-bump.yaml', '.flow-bump.yml', '.flow-bump.yaml' ];
    const DIRECTORIES : string[] = [];
    
    if(!noLocal) {
        let dir = process.cwd();
        
        do {
            DIRECTORIES.push(dir);
        } while(!noParent && (dir = path.dirname(dir)) !== '/');
    }
    
    if(!noGlobal) {
        DIRECTORIES.push(os.homedir());
    }
    
    for(const dir of DIRECTORIES) {
        for(const name of FILE_NAMES) {
            const file = path.join(dir, name);
            if(await fs.pathExists(file)) {
                const config = YAML.load(file);
                if(null == config) {
                    throw new SyntaxError(`Error in yaml file "${file}"`);
                }
                return [ file, config ];
            }
        }
    }
    
    return [ null, {} ];
}

async function writeYamlConfig(mode : 'local' | 'global', config : { options? : Partial<IOptions>, prefix? : Partial<IPrefix>, branch? : Partial<IBranch>, scripts? : IScripts }) : Promise<string> {
    let [ file ] = mode === 'local' ? await loadYamlConfig({
        noGlobal: true,
        noParent: true
    }) : await loadYamlConfig({ noLocal: true });
    
    if(!file) {
        file = mode === 'local' ? 'flow-bump.yml' : os.homedir() + '/.flow-bump.yml';
    }
    
    await fs.writeFile(file, YAML.stringify(config));
    
    return file;
}

async function loadGitConfig() : Promise<{ prefix? : IPrefix, branch? : IBranch }> {
    const GIT_CONFIG_FILE = path.join(process.cwd(), '.git/config');
    if(!await fs.pathExists(GIT_CONFIG_FILE)) {
        return {}
    }
    
    const GIT_CONFIG = ini.parse(await fs.readFile(GIT_CONFIG_FILE, 'utf-8'));
    
    return {
        prefix: GIT_CONFIG[ 'gitflow "prefix"' ],
        branch: GIT_CONFIG[ 'gitflow "branch"' ]
    }
}

async function load(args : any) : Promise<{ options : IOptions, prefix : IPrefix, branch : IBranch, scripts? : IScripts }> {
    const ARG_OPTIONS = {
        ...(null != args.commitMsg ? { commitMessage: args.commitMsg } : {}),
        ...(null != args.pull ? { pull: args.pull } : {}),
        ...(null != args.push ? { push: args.push } : {}),
        ...(null != args.tagBranch ? { tagBranch: args.tagBranch } : {}),
        ...(null != args.keepBranch ? { keepBranch: args.keepBranch } : {})
    };
    
    const GIT_CONFIG = await loadGitConfig();
    const [ , YAML_CONFIG ] = await loadYamlConfig();
    
    const options : IOptions = {
        ...DEFAULT_OPTIONS,
        ...(YAML_CONFIG.options || {}),
        ...ARG_OPTIONS
    };
    
    const prefix : IPrefix = {
        ...DEFAULT_PREFIX,
        ...(GIT_CONFIG.prefix || {}),
        ...(YAML_CONFIG.prefix || {})
    };
    
    const branch : IBranch = {
        ...DEFAULT_BRANCH,
        ...(GIT_CONFIG.branch || {}),
        ...(YAML_CONFIG.branch || {})
    };
    
    return { options, prefix, branch, scripts: YAML_CONFIG.scripts };
}
