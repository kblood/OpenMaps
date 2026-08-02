declare module '@mapbox/mbtiles' {
  export class MBTiles {
    constructor(uri: string, callback: (err: Error | null, mbtiles: MBTiles) => void);
    getTile(z: number, x: number, y: number, callback: (err: Error | null, tile: Buffer, headers: any) => void): void;
    getInfo(callback: (err: Error | null, info: any) => void): void;
    close(callback: (err: Error | null) => void): void;
  }
}