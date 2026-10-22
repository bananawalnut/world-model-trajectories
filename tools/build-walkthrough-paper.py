"""Build the synthetic, source-locatable paper used by the guided walkthrough."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

target = Path(__file__).resolve().parents[1] / 'site/papers/walkthrough.pdf'
c = canvas.Canvas(str(target), pagesize=(612, 792), invariant=1)
c.setTitle('A small theory of Tweety - WMT walkthrough')
c.setAuthor('WMT demonstration; synthetic teaching paper')

def text(x, y, value, size=11, font='Helvetica', color='#241f19'):
    c.setFillColor(HexColor(color)); c.setFont(font, size); c.drawString(x, y, value)

def base(page, subtitle):
    c.setFillColor(HexColor('#faf6ea')); c.rect(0, 0, 612, 792, fill=1, stroke=0)
    text(48, 747, 'WORLD-MODEL TRAJECTORIES / READING COPY', 9, color='#5b8a5a')
    text(48, 710, 'A small theory of Tweety', 26, 'Times-Bold')
    text(48, 685, subtitle, 11, color='#8a6a47')
    c.setStrokeColor(HexColor('#c5bba8')); c.line(48, 667, 564, 667)
    text(48, 36, 'Synthetic teaching paper. Claims and roles below are author-supplied.', 9, color='#8a6a47')
    text(540, 36, str(page), 9)

def label(y, number, role):
    text(48, y, f'{number} / {role.upper()}', 9, 'Helvetica-Bold', '#5b8a5a')

base(1, 'Vocabulary, assumptions, and an observation')
text(48, 631, '1. Vocabulary', 16, 'Times-Bold')
text(48, 606, 'Thing: the domain of individuals.')
text(48, 586, 'Bird, Penguin, Flies: predicates with signature Thing -> Bool.')
text(48, 566, 'tweety: an individual of sort Thing.')
text(48, 534, 'The vocabulary introduces symbols; it does not assert their extension.', 10, color='#8a6a47')
text(48, 490, '2. Starting points', 16, 'Times-Bold')
label(459, 'A1', 'Axiom 1')
text(48, 436, 'All penguins are birds.', 13, 'Times-Roman')
text(48, 415, 'Assume a universal inclusion for this small theory.', 10, color='#8a6a47')
label(372, 'A2', 'Axiom 2')
text(48, 349, 'No penguins are fliers.', 13, 'Times-Roman')
text(48, 328, 'Assume a strict exclusion, without exceptions, in this theory.', 10, color='#8a6a47')
label(285, 'O1', 'Observation')
text(48, 262, 'Tweety is a penguin.', 13, 'Times-Roman')
text(48, 241, 'Take this as an input fact; no empirical validation accompanies it.', 10, color='#8a6a47')
text(48, 169, 'Reading note', 13, 'Times-Bold')
text(48, 146, 'Axioms supply assumptions. An observation supplies another premise.', 10)
text(48, 128, 'The next page states two consequences and two unresolved passages.', 10)
c.showPage()
base(2, 'Consequences and unresolved language')
text(48, 631, '3. Stated consequences', 16, 'Times-Bold')
label(598, 'L1', 'Lemma 1')
text(48, 575, 'Tweety is a bird.', 13, 'Times-Roman')
text(48, 554, 'Proof sketch: instantiate A1 at tweety; apply the observation O1.', 10, color='#8a6a47')
label(511, 'T1', 'Theorem 1')
text(48, 488, 'Tweety is not a flier.', 13, 'Times-Roman')
text(48, 467, 'Proof sketch: instantiate A2 at tweety; apply the observation O1.', 10, color='#8a6a47')
text(48, 413, '4. Deliberately unresolved passages', 16, 'Times-Bold')
label(380, 'U1', 'Ambiguous generalization')
text(48, 357, 'Birds are normally fliers.', 13, 'Times-Roman')
text(48, 336, 'Reading question: strict universal, statistical tendency, or default?', 10, color='#8a6a47')
label(293, 'U2', 'Ambiguous reference')
text(48, 270, 'It is a flier.', 13, 'Times-Roman')
text(48, 249, 'Reading question: which individual does "it" refer to?', 10, color='#8a6a47')
text(48, 181, 'What a check would establish', 13, 'Times-Bold')
text(48, 158, 'A proof check concerns the exact formal conclusion and named premises.', 10)
text(48, 140, 'A coherence check concerns compatibility of the selected formal claims.', 10)
text(48, 122, 'Neither check validates the observations or resolves ordinary language.', 10)
c.save()
print(target)
