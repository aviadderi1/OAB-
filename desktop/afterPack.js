// Sets the OAB icon and version info on "OAB Studio.exe" without Wine (resedit is pure JavaScript).
const path = require('path'), fs = require('fs');
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit'); const PE = await import('pe-library');
  const exe = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.exe');
  const ver = ctx.packager.appInfo.version;
  const data = fs.readFileSync(exe);
  const pe = PE.NtExecutable.from(data, { ignoreCert: true });
  const res = PE.NtExecutableResource.from(pe);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'build', 'icon.ico')));
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, ico.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  const [a, b, c] = ver.split('.').map(Number);
  vi.setFileVersion(a, b, c, 0, 1033); vi.setProductVersion(a, b, c, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, { FileDescription: 'OAB Studio', ProductName: 'OAB Studio', CompanyName: 'AD SOUND & SERVICE', LegalCopyright: 'AD SOUND & SERVICE', OriginalFilename: 'OAB Studio.exe', InternalName: 'OAB Studio' });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(pe);
  fs.writeFileSync(exe, Buffer.from(pe.generate()));
  console.log('  • OAB icon + version set on', path.basename(exe));
};
