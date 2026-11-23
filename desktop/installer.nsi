; OAB Studio – Windows installer (per user, no admin needed)
Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"

!ifndef VERSION
  !define VERSION "1.2.0"
!endif
!define APPNAME "OAB Studio"
!define EXE "OAB Studio.exe"
!define COMPANY "AD SOUND & SERVICE"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.adsound.oab"

Name "${APPNAME}"
OutFile "dist\OAB-Studio-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\OAB Studio"
InstallDirRegKey HKCU "Software\OAB Studio" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
BrandingText "OAB – On Air Broadcast · ${COMPANY}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "CompanyName" "${COMPANY}"
VIAddVersionKey "FileDescription" "${APPNAME} Setup"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "${COMPANY}"

!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "build\wizard.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "build\wizard.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "build\header.bmp"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "הפעל את OAB Studio"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Hebrew"

Function .onInit
  ; close a running OAB Studio (also during automatic updates)
  nsExec::Exec 'taskkill /F /IM "${EXE}"'
  Sleep 800
FunctionEnd

Section "OAB Studio" SecMain
  SetOutPath "$INSTDIR"
  ; the bundled python of the previous version may still be closing
  nsExec::Exec 'taskkill /F /FI "MODULES eq python312.dll" /FI "IMAGENAME eq python.exe"'
  RMDir /r "$INSTDIR\resources\server"
  RMDir /r "$INSTDIR\resources\app.asar.unpacked"
  File /r "dist\win-unpacked\*.*"
  WriteUninstaller "$INSTDIR\Uninstall OAB Studio.exe"
  CreateShortCut "$DESKTOP\OAB Studio.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  CreateDirectory "$SMPROGRAMS\OAB Studio"
  CreateShortCut "$SMPROGRAMS\OAB Studio\OAB Studio.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  CreateShortCut "$SMPROGRAMS\OAB Studio\Uninstall OAB Studio.lnk" "$INSTDIR\Uninstall OAB Studio.exe"
  WriteRegStr HKCU "Software\OAB Studio" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "${COMPANY}"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\${EXE}"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Uninstall OAB Studio.exe"'
  WriteRegStr HKCU "${UNKEY}" "QuietUninstallString" '"$INSTDIR\Uninstall OAB Studio.exe" /S'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "${UNKEY}" "EstimatedSize" "$0"
  ; Windows firewall asks once for the OAB server (listeners on the network / internet)
  ; after a silent update (/S) start the app again
  IfSilent 0 +2
    Exec '"$INSTDIR\${EXE}"'
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM "${EXE}"'
  Sleep 800
  Delete "$DESKTOP\OAB Studio.lnk"
  RMDir /r "$SMPROGRAMS\OAB Studio"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNKEY}"
  DeleteRegKey HKCU "Software\OAB Studio"
  ; your settings, playlists and recordings stay in %APPDATA%\OAB
SectionEnd
