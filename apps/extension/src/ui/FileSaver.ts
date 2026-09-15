/** Hands a generated file to the user. Behind an interface so the Options page is testable without a download. */
export interface FileSaver {
  save(filename: string, content: string, mimeType: string): void;
}

/** Blob + temporary <a download>: no `downloads` permission needed, nothing leaves the machine. */
export class AnchorFileSaver implements FileSaver {
  constructor(private readonly doc: Document) {}

  save(filename: string, content: string, mimeType: string): void {
    const win = this.doc.defaultView;
    if (!win) {
      return;
    }
    const url = win.URL.createObjectURL(new win.Blob([content], { type: mimeType }));
    const anchor = this.doc.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    this.doc.body.append(anchor);
    anchor.click();
    anchor.remove();
    win.URL.revokeObjectURL(url);
  }
}
