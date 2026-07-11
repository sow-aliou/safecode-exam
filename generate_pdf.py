from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

doc = SimpleDocTemplate("Epreuve_Simulation.pdf", pagesize=A4)
styles = getSampleStyleSheet()

TitleStyle = styles['Title']
NormalStyle = styles['Normal']
HeadingStyle = styles['Heading2']

story = []

story.append(Paragraph("Sujet d'Examen : Ingénierie Logicielle", TitleStyle))
story.append(Spacer(1, 0.5 * inch))

story.append(Paragraph("Contexte Global", HeadingStyle))
story.append(Paragraph("Vous êtes en charge de concevoir et développer un système de gestion pour une bibliothèque universitaire. Le système doit permettre aux étudiants d'emprunter des livres et aux bibliothécaires de gérer le stock.", NormalStyle))
story.append(Spacer(1, 0.5 * inch))

story.append(Paragraph("Question 1 : Compréhension du besoin (Texte)", HeadingStyle))
story.append(Paragraph("Décrivez en quelques phrases les acteurs principaux de ce système et leurs responsabilités respectives.", NormalStyle))
story.append(Spacer(1, 0.5 * inch))

story.append(Paragraph("Question 2 : Conception (UML)", HeadingStyle))
story.append(Paragraph("Réalisez le diagramme de classes pour ce système. Pensez à inclure au moins les classes : Livre, Utilisateur, Etudiant, Bibliothecaire et Emprunt.", NormalStyle))
story.append(Spacer(1, 0.5 * inch))

story.append(Paragraph("Question 3 : Implémentation (Code)", HeadingStyle))
story.append(Paragraph("Écrivez le code de la classe 'Emprunt' avec ses attributs et une méthode permettant de vérifier si le livre est en retard (date de retour prévue dépassée).", NormalStyle))
story.append(Spacer(1, 0.5 * inch))

story.append(Paragraph("Bonne chance !", NormalStyle))

doc.build(story)
print("PDF Epreuve_Simulation.pdf généré avec succès.")
