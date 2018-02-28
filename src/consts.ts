export type MainCommand = 'major'|'minor'|'patch';
export type HotfixCommand = 'fix';
export type IncCommand = 'alpha'|'beta'|'rc';
export type SpecCommand = 'release'|'hotfix';
export type FinalCommand = 'final';
export type Command = MainCommand|HotfixCommand|IncCommand|SpecCommand|FinalCommand;

export const MAIN_RELEASE_COMMANDS : MainCommand[] = [ 'major', 'minor', 'patch' ];
export const HOTFIX_RELEASE_COMMANDS : HotfixCommand[] = [ 'fix' ];
export const SPEC_RELEASE_COMMANDS : SpecCommand[] = [ 'release', 'hotfix' ];
export const INC_RELEASE_COMMANDS : IncCommand[] = [ 'rc', 'beta', 'alpha' ];
export const FINAL_RELEASE_COMMANDS : FinalCommand[] = [ 'final' ];

export function isMainCommand(cmd : any) : cmd is MainCommand {
    return MAIN_RELEASE_COMMANDS.includes(cmd);
}

export function isHotfixCommand(cmd : any) : cmd is HotfixCommand {
    return HOTFIX_RELEASE_COMMANDS.includes(cmd);
}

export function isSpecCommand(cmd : any) : cmd is SpecCommand {
    return SPEC_RELEASE_COMMANDS.includes(cmd);
}

export function isIncCommand(cmd : any) : cmd is IncCommand {
    return INC_RELEASE_COMMANDS.includes(cmd);
}

export function isFinalCommand(cmd : any) : cmd is FinalCommand {
    return FINAL_RELEASE_COMMANDS.includes(cmd);
}
