import type { DataType as FfiDataType } from "ffi-rs";

export type MacHapticPattern = "generic" | "alignment" | "level-change";

const PATTERN_CODE: Readonly<Record<MacHapticPattern, number>> = {
  generic: 0,
  alignment: 1,
  "level-change": 2,
};
const PERFORM_NOW = 1;

let performerPromise: Promise<(pattern: MacHapticPattern) => void> | undefined;

export function performMacHaptic(pattern: MacHapticPattern): Promise<void> {
  performerPromise ??= import("ffi-rs").then(({ DataType, load, open }) => {
    const objc = "supacode-objc";
    open({ library: objc, path: "/usr/lib/libobjc.A.dylib" });
    const pointer = (funcName: string, paramsType: FfiDataType[], paramsValue: unknown[]) =>
      load({
        library: objc,
        funcName,
        retType: DataType.BigInt,
        paramsType,
        paramsValue,
      }) as bigint;
    const selector = (name: string) => pointer("sel_registerName", [DataType.String], [name]);
    const performer = pointer(
      "objc_msgSend",
      [DataType.BigInt, DataType.BigInt],
      [
        pointer("objc_getClass", [DataType.String], ["NSHapticFeedbackManager"]),
        selector("defaultPerformer"),
      ],
    );
    const perform = selector("performFeedbackPattern:performanceTime:");
    return (next) => {
      if (performer === 0n) return;
      load({
        library: objc,
        funcName: "objc_msgSend",
        retType: DataType.Void,
        paramsType: [DataType.BigInt, DataType.BigInt, DataType.I64, DataType.I64],
        paramsValue: [performer, perform, PATTERN_CODE[next], PERFORM_NOW],
      });
    };
  });
  return performerPromise.then((perform) => perform(pattern));
}
