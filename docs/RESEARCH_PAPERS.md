# Research Papers for Testing TheAgent v0.2.0

> Curated list of cerebellar stroke and decompressive craniectomy research papers

## 🎯 Open Access Papers (Recommended for Testing)

### 1. Beez et al. (2019) - Critical Care ⭐ **Primary Test Paper**

**Title:** Decompressive craniectomy for acute ischemic stroke

**Authors:** Thomas Beez, Christopher Munoz-Bendix, Hans-Jakob Steiger, Kerim Beseoglu

**Journal:** Critical Care, 2019; Volume 23, Article 209

**DOI:** [10.1186/s13054-019-2490-x](https://doi.org/10.1186/s13054-019-2490-x)

**PDF:** [Download from PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6556035/)

**Why test with this:**
- ✅ Open access (free PDF download)
- ✅ Comprehensive review of decompressive craniectomy
- ✅ Contains tables and data
- ✅ Covers both supratentorial and infratentorial DC
- ✅ Multiple outcomes reported (mortality, mRS, GOS)
- ✅ Recent publication (2019)

**Expected extraction:**
- Study design: Systematic review
- Outcomes: Mortality, functional outcomes (mRS, GOS)
- Tables: Multiple outcome tables
- Imaging: Mentions of infarct volumes, edema
- Citations: Extensive reference list

---

### 2. von Gottberg et al. (2024) - Springer ⭐ **Latest Research**

**Title:** Suboccipital Decompressive Necrosectomy After Cerebellar Stroke with Good Clinical Outcome

**Authors:** Philipp von Gottberg, C. Knispel, J.E. Cohen, O. Ganslandt, H. Bäzner, H. Henkes

**Year:** 2024 (November 26)

**Publisher:** Springer (The Ischemic Stroke Casebook)

**ResearchGate:** [Available here](https://www.researchgate.net/publication/386128007)

**Why test with this:**
- ✅ Most recent publication (2024)
- ✅ Cerebellar stroke specific
- ✅ Case study with imaging data
- ✅ Good clinical outcomes
- ✅ Detailed surgical procedure description

**Expected extraction:**
- Study design: Case report
- Procedure: Suboccipital decompressive necrosectomy
- Outcomes: Good clinical outcome (specific mRS/GOS)
- Imaging: Infarct volume, edema, midline shift

---

### 3. Raco et al. (1992) - Stroke (AHA) ⭐ **Classic Paper**

**Title:** Treatment of cerebellar infarction by decompressive suboccipital craniectomy

**Journal:** Stroke, 1992; 23(7):957

**DOI:** [10.1161/01.STR.23.7.957](https://doi.org/10.1161/01.STR.23.7.957)

**PubMed:** [Available](https://www.ahajournals.org/doi/10.1161/01.STR.23.7.957)

**Why test with this:**
- ✅ Seminal work on cerebellar SDC
- ✅ Clear outcome reporting
- ✅ Multiple patients (case series)
- ✅ Established methodology

**Expected extraction:**
- Study design: Case series
- Procedure: Decompressive suboccipital craniectomy
- Sample size: Multiple patients
- Outcomes: Mortality, neurological improvement

---

### 4. Swiss Recommendations (2009) - PubMed

**Title:** Decompressive craniectomy for space occupying hemispheric and cerebellar ischemic strokes: Swiss recommendations

**Journal:** International Journal of Stroke, 2009

**PubMed:** [19659825](https://pubmed.ncbi.nlm.nih.gov/19659825/)

**Why test with this:**
- ✅ Clinical guidelines
- ✅ Comprehensive recommendations
- ✅ Multiple outcome criteria
- ✅ Good for outcome harmonization testing

**Expected extraction:**
- Study design: Guidelines/recommendations
- Outcomes: Standardized outcome definitions
- Indications: Clear surgical criteria
- Harmonization: Standard timepoints (30, 90, 180 days)

---

## 📊 Test Coverage Matrix

| Paper | Full-PDF | Tables | Imaging | Harmonizer | Citations | Multi-Source |
|-------|----------|--------|---------|------------|-----------|--------------|
| Beez 2019 | ✅ | ✅✅ | ✅ | ✅ | ✅✅ | ✅ |
| von Gottberg 2024 | ✅ | ✅ | ✅✅ | ✅ | ✅ | - |
| Raco 1992 | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| Swiss 2009 | ✅ | ✅ | - | ✅✅ | ✅ | ✅ |

**Legend:**
- ✅ = Good test case
- ✅✅ = Excellent test case
- `-` = Limited applicability

---

## 🔬 Additional Test Papers

### Decompressive Craniectomy for Stroke (General)

1. **Decompressive Craniectomy for Cerebral Infarction** (Stroke, 1995)
   - DOI: 10.1161/01.STR.26.2.259
   - [PubMed Link](https://www.ahajournals.org/doi/10.1161/01.STR.26.2.259)

2. **Decompressive Craniectomy for Stroke: Who, When, and How** (2022)
   - [PubMed: 35465878](https://pubmed.ncbi.nlm.nih.gov/35465878/)

3. **Decompressive Hemicraniectomy for Large Hemispheric Strokes** (2020)
   - DOI: 10.1161/STROKEAHA.120.032359
   - [Stroke Journal](https://www.ahajournals.org/doi/10.1161/STROKEAHA.120.032359)

---

## 🎯 Testing Strategy

### Phase 1: Single Paper Testing

**Start with Beez 2019:**
```bash
# Download PDF
wget "https://pmc.ncbi.nlm.nih.gov/articles/PMC6556035/pdf/13054_2019_Article_2490.pdf" -O beez2019.pdf

# Test individual modules
npm run cli -- process beez2019.pdf --modules imaging --verbose
npm run cli -- process beez2019.pdf --modules tables --verbose
npm run cli -- process beez2019.pdf --modules harmonizer --verbose

# Full extraction
npm run cli -- process beez2019.pdf --verbose
```

### Phase 2: Multi-Paper Validation

**Test consistency across papers:**
```bash
# Process multiple papers
npm run cli -- process beez2019.pdf
npm run cli -- process vongottberg2024.pdf
npm run cli -- process raco1992.pdf

# Compare outcomes for consistency
```

### Phase 3: Multi-Source Fusion

**Test with main + supplement:**
```bash
# If available, test with main paper + supplementary materials
npm run cli -- fuse main:beez2019.pdf supplement:beez2019_supp.pdf
```

---

## 📥 Download Scripts

### Quick Download Script

Create `download_papers.sh`:

```bash
#!/bin/bash
mkdir -p test_papers
cd test_papers

echo "Downloading Beez et al. 2019..."
wget -O beez2019.pdf "https://pmc.ncbi.nlm.nih.gov/articles/PMC6556035/pdf/13054_2019_Article_2490.pdf"

echo "Papers downloaded to test_papers/"
ls -lh
```

### Using curl (if wget not available):

```bash
curl -L "https://pmc.ncbi.nlm.nih.gov/articles/PMC6556035/pdf/13054_2019_Article_2490.pdf" -o beez2019.pdf
```

---

## 📊 Expected Results

### Beez et al. 2019 Expected Extraction

**Study Metadata:**
```json
{
  "study_id": "beez2019",
  "authors": "Beez T, Munoz-Bendix C, Steiger HJ, Beseoglu K",
  "year": "2019",
  "title": "Decompressive craniectomy for acute ischemic stroke",
  "journal": "Critical Care",
  "study_design": "systematic_review"
}
```

**Tables:**
- Multiple outcome tables
- Patient characteristics
- Mortality rates
- Functional outcomes (mRS, GOS)

**Outcomes:**
- Mortality: Various percentages by study
- mRS 0-2: Good outcomes
- mRS 0-3: Favorable outcomes
- GOS: Good recovery rates

**Citations:**
- 50+ references expected
- Format: Vancouver (medical standard)
- DOIs available for most

---

## 🔍 Validation Checklist

After processing each paper, verify:

- [ ] Study ID extracted correctly
- [ ] Authors parsed accurately
- [ ] Year and journal identified
- [ ] Study design classified
- [ ] Tables extracted with structure preserved
- [ ] Imaging metrics captured (if applicable)
- [ ] Outcomes harmonized to standard timepoints
- [ ] Citations extracted with DOIs
- [ ] Confidence scores reasonable (>0.80)
- [ ] No critical fields missing

---

## 🚀 Quick Start Command

```bash
# Process Beez 2019 (primary test paper)
npm run cli -- process test_papers/beez2019.pdf --verbose

# View results
cat beez2019.json | jq '.'

# Check extraction quality
cat beez2019.json | jq '.modules_executed, .warnings, .errors'
```

---

## 📚 Additional Resources

### PubMed Search Queries

**Find more papers:**
```
cerebellar stroke AND decompressive craniectomy AND (open access[Filter])
cerebellar infarction AND suboccipital craniectomy
malignant cerebellar stroke AND surgical treatment
```

### Citation Networks

Use [Connected Papers](https://www.connectedpapers.com/) to find related research:
- Input: 10.1186/s13054-019-2490-x
- Explore: Similar papers in citation network

---

**Last Updated:** November 2024
**Papers Verified:** November 2024
**Status:** ✅ Ready for Testing
