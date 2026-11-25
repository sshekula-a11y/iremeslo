# Test exportu ISDOC

Schémata `*.xsd` jsou oficiální ISDOC 6.0.2 z https://github.com/isdoc/schema (© MVČR, ICT UNIE).
`npm run test:isdoc` vytvoří ukázkové doklady (faktura plátce i neplátce, přenesená daňová povinnost,
zálohová faktura, daňový doklad k platbě, faktura bez bankovního účtu) a ověří je proti schématu (xmllint).
