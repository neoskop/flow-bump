import 'source-map-support/register';
import * as yargs from 'yargs';
import * as semver from 'semver';
import { flowBump, IOptions, IPrefix, IBranch } from './flow-bump';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as YAML from 'yamljs';
import * as ini from 'ini';

const COMMANDS = [ 'hotfix', 'patch', 'minor', 'major', 'alpha', 'beta', 'rc', 'final' ];

export async function cli() {
    yargs.option('pull', {
        describe: "Pull from git before branching and bumping (via --no-pull)"
    });
    
    yargs.option('push', {
        describe: "Push to git after branching and bumping (via --no-push)"
    });
    
    yargs.options('branch', {
        alias: 'b',
        describe: 'Create version from which branch',
        type: 'string'
    });
    
    yargs.options('tag', {
        alias: 't',
        describe: 'Create version from which tag',
        type: 'string'
    });
    
    yargs.option('commit-msg', {
        alias: 'm',
        describe: 'Template for commit message',
        type: 'string'
    });
    
    yargs.options('keep-branch', {
        alias: 'k',
        describe: 'Keep branch after git flow finish release',
        type: 'boolean'
    });
    
    yargs.options('type', {
        alias: 'T',
        describe: '"release" or "hotfix", used when providing a valid semver version'
    });
    
    yargs.options('tag-branch', {
        describe: 'Tag branch instead of master for final'
    });
    
    yargs.command('<command>', `Create a version.\n'${COMMANDS.join("', '")}' or semver version like '1.2.3'`, argv => {
        return argv.positional('command', {
            type: 'string'
        })
    });
    
    yargs.demandCommand(1);
    
    const args = yargs.parse();
    
    try {
    
        const { prefix, branch, options } = await load(args);
    
        if(args._.length !== 1
            || (-1 === COMMANDS.indexOf(args._[ 0 ]) && !semver.valid(args._[ 0 ]))
            || args.branch && args.tag) {
            yargs.showHelp();
            process.exit();
        }
    
        await flowBump(args._[ 0 ], {
            ...options,
            branch: args.branch,
            tag   : args.tag,
            type  : args.type,
            tagBranch: !!args.tagBranch
        }, prefix, branch);
    } catch(err) {
        console.error(err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

async function loadYamlConfig() : Promise<{ options?: Partial<IOptions>, prefix?: Partial<IPrefix>, branch?: Partial<IBranch> }> {
    const CONFIG_FILES = [
        path.join(process.cwd(), 'flow-bump.yml'),
        path.join(process.cwd(), 'flow-bump.yaml'),
        path.join(process.cwd(), '.flow-bump.yml'),
        path.join(process.cwd(), '.flow-bump.yaml')
    ];
    
    for(const file of CONFIG_FILES) {
        if(await fs.pathExists(file)) {
            const config = YAML.load(file);
            if(null == config) {
                throw new SyntaxError(`Error in yaml file "${file}"`);
            }
        }
    }
    
    return {};
}

async function loadGitConfig() : Promise<{ prefix?: IPrefix, branch?: IBranch }> {
    const GIT_CONFIG_FILE = path.join(process.cwd(), '.git/config');
    if(!await fs.pathExists(GIT_CONFIG_FILE)) {
        return {}
    }
    
    const GIT_CONFIG = ini.parse(await fs.readFile(GIT_CONFIG_FILE, 'utf-8'));
    
    return {
        prefix: GIT_CONFIG['gitflow "prefix"'],
        branch: GIT_CONFIG['gitflow "branch"']
    }
}

async function load(args : any) : Promise<{ options: IOptions, prefix: IPrefix, branch: IBranch }> {
    const DEFAULT_OPTIONS : IOptions = {
        pull: true,
        push: true,
        commitMessage: 'Bump to version %VERSION%',
        keepBranch: false,
        tagBranch: false
    };
    
    const DEFAULT_BRANCH : IBranch = {
        develop: 'develop',
        master: 'master'
    };
    
    const DEFAULT_PREFIX : IPrefix = {
        release: 'release/',
        hotfix: 'hotfix/',
        versiontag: ''
    };
    
    const ARG_OPTIONS = {
        ...(null != args.commitMsg ? { commitMessage: args.commitMsg } : {}),
        ...(null != args.pull ? { pull: args.pull } : {}),
        ...(null != args.push ? { push: args.push } : {})
    };
    
    const GIT_CONFIG = await loadGitConfig();
    const YAML_CONFIG = await loadYamlConfig();
    
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
    
    return { options, prefix, branch };
}
