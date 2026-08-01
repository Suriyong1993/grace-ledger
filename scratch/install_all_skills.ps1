# Script to download and install AI Agent Skills and CLI Tools

$workspaceSkills = "c:\Users\Administrator\Desktop\grace-v.2\grace-ledger\.agents\skills"
$globalSkills = "C:\Users\Administrator\.gemini\config\skills"
$tempDir = "c:\Users\Administrator\Desktop\grace-v.2\grace-ledger\.agents\temp_download"

# Ensure target directories exist
New-Item -ItemType Directory -Force -Path $workspaceSkills | Out-Null
New-Item -ItemType Directory -Force -Path $globalSkills | Out-Null
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

Write-Host "=== 1. Downloading Agent Skill Repositories ===" -ForegroundColor Green

$repos = @(
    "https://github.com/anthropics/skills.git",
    "https://github.com/vercel-labs/skills.git",
    "https://github.com/vercel-labs/agent-skills.git",
    "https://github.com/sickn33/antigravity-awesome-skills.git",
    "https://github.com/ComposioHQ/awesome-claude-skills.git",
    "https://github.com/BehiSecc/awesome-claude-skills.git",
    "https://github.com/trailofbits/skills.git",
    "https://github.com/microsoft/skills.git",
    "https://github.com/steipete/agent-rules.git",
    "https://github.com/obra/superpowers.git",
    "https://github.com/affaan-m/everything-claude-code.git"
)

foreach ($repo in $repos) {
    $folderName = ($repo -split "/")[-1] -replace "\.git$", ""
    $targetPath = Join-Path $tempDir $folderName
    if (Test-Path $targetPath) {
        Write-Host "Updating $folderName..." -ForegroundColor Cyan
        git -C $targetPath pull --quiet
    } else {
        Write-Host "Cloning $folderName..." -ForegroundColor Cyan
        git clone --depth 1 $repo $targetPath --quiet
    }
}

Write-Host "=== 2. Installing Skills into .agents/skills & Global Config ===" -ForegroundColor Green

$skillFiles = Get-ChildItem -Path $tempDir -Recurse -Filter "SKILL.md"

foreach ($file in $skillFiles) {
    $sourceDir = $file.DirectoryName
    $skillName = $file.Directory.Name
    
    # Avoid duplicating root folder names if generic
    if ($skillName -eq "skills" -or $skillName -eq "temp_download") {
        continue
    }

    $destWorkspace = Join-Path $workspaceSkills $skillName
    $destGlobal = Join-Path $globalSkills $skillName

    if (-not (Test-Path $destWorkspace)) {
        Copy-Item -Path $sourceDir -Destination $destWorkspace -Recurse -Force
        Write-Host "Added skill to workspace: $skillName" -ForegroundColor Yellow
    }

    if (-not (Test-Path $destGlobal)) {
        Copy-Item -Path $sourceDir -Destination $destGlobal -Recurse -Force
        Write-Host "Added skill to global: $skillName" -ForegroundColor Yellow
    }
}

Write-Host "=== 3. Clean up temporary download folder ===" -ForegroundColor Green
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "=== Installation Complete! ===" -ForegroundColor Green
