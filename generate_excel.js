import * as XLSX from 'xlsx';
import fs from 'fs';

// 1. Liste des étudiants
const students = [
  { matricule: 'ETU001', nom: 'Diop', prenom: 'Moussa', email: 'moussa.diop@example.com' },
  { matricule: 'ETU002', nom: 'Sarr', prenom: 'Aminata', email: 'aminata.sarr@example.com' },
  { matricule: 'ETU003', nom: 'Ndiaye', prenom: 'Cheikh', email: 'cheikh.ndiaye@example.com' },
  { matricule: 'ETU004', nom: 'Fall', prenom: 'Fatou', email: 'fatou.fall@example.com' }
];

const ws = XLSX.utils.json_to_sheet(students);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Etudiants");

XLSX.writeFile(wb, 'liste_etudiants.xlsx');
console.log('Fichier liste_etudiants.xlsx créé avec succès !');
