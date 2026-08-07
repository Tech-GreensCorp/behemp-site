#!/bin/bash
cd "/Users/gabrieldiniz/Desktop/Projetos Behemp/behemp-site-main"

git log --oneline -3

export TAG_NAME="backup-pre-puppeteer-$(date +%Y%m%d-%H%M)"

git tag -a "$TAG_NAME" -m "Backup completo antes da migração Puppeteer para @sparticuz/chromium. Estado: Fases 1, 2 e 4 implementadas e funcionando em localhost. DocuSign Embedded Signing funcionando. ANVISA dual-modal implementado."

git tag -l "backup-*"

git -c credential.helper= push origin --tags

git checkout -b backup/fases-1-2-4-pre-puppeteer

git -c credential.helper= push origin backup/fases-1-2-4-pre-puppeteer

git checkout feature/fases-1-2-4 || git checkout main
