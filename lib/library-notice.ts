/** Ephemeral, consumed-on-arrival outcomes; never persisted into package content. */
export interface LibraryNotice {
  message: string; recordId: string; outcome: "added" | "existing" | "replaced"; tab: "received" | "drafts";
}
let notice: LibraryNotice | undefined;
let builderNotice: string | undefined;
export function setLibraryNotice(value: LibraryNotice): void { notice = value; }
export function consumeLibraryNotice(): LibraryNotice | undefined { const value = notice; notice = undefined; return value; }
export function setBuilderNotice(value: string): void { builderNotice = value; }
export function consumeBuilderNotice(): string | undefined { const value = builderNotice; builderNotice = undefined; return value; }
