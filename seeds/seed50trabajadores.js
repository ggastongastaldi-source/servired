const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const MONGO_URI = 'mongodb+srv://ggastonnet_db_user:servired2024@cluster0.fjqkqhf.mongodb.net/servired?retryWrites=true&w=majority';
const usuarioSchema = new mongoose.Schema({ nombre:{type:String,required:true}, email:{type:String,required:true,unique:true}, password:{type:String,required:true}, roles:{type:[String],default:['TRABAJADOR']}, rol:{type:String,default:'TRABAJADOR'}, estado:{type:String,default:'ACTIVO'}, disponible:{type:Boolean,default:true}, isOnline:{type:Boolean,default:false}, especialidades:[String], rubro:{type:String,default:null}, ubicacion:{type:{type:String,default:'Point'},coordinates:{type:[Number],default:[-58.3816,-34.6037]}}, telefono:{type:String,default:''}, calificacion:{type:Number,default:0}, totalTrabajos:{type:Number,default:0}, verificado:{type:Boolean,default:true} },{timestamps:true});
const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);
const zonas = [[-58.3816,-34.6037],[-58.4209,-34.5885],[-58.3900,-34.6400],[-58.5300,-34.4700],[-58.6500,-34.6600],[-58.4000,-34.7800],[-58.5796,-34.4260],[-58.3925,-34.7609],[-58.6190,-34.6530],[-58.5271,-34.4731]];
const rubros = ['plomeria','electricidad','gasista','pintura','albanileria','cerrajeria','aire_acondicionado','herreria','carpinteria','limpieza'];
const nombres = ['Alejandro Garcia','Bruno Fernandez','Carlos Lopez','Diego Martinez','Eduardo Rodriguez','Fernando Gonzalez','Gustavo Perez','Hernan Sanchez','Ignacio Romero','Javier Torres','Kevin Diaz','Leonardo Flores','Mateo Ruiz','Nicolas Moreno','Oscar Jimenez','Pablo Alvarez','Quintin Herrera','Ricardo Medina','Sebastian Castro','Tomas Vargas','Ulises Ramos','Valentin Reyes','Walter Cruz','Xavier Ortiz','Yamil Gutierrez','Adriana Molina','Beatriz Suarez','Carolina Mendoza','Daniela Aguilar','Elena Campos','Florencia Vega','Gabriela Rios','Hilda Sandoval','Iris Cabrera','Julia Herrera','Karina Guerrero','Laura Miranda','Marcela Soto','Natalia Delgado','Patricia Leon','Rosa Fuentes','Sandra Marin','Teresa Navarro','Ursula Ibanez','Veronica Rojas','Wanda Ponce','Ximena Carrillo','Yolanda Pena','Zulema Pacheco','Amalia Quispe'];
async function seed(){
  await mongoose.connect(MONGO_URI,{family:4});
  console.log('Conectado');
  const passHash = await bcrypt.hash('Servired2024!',10);
  const trabajadores = nombres.map((nombre,i)=>{
    const z=zonas[i%zonas.length];
    const r=rubros[i%rubros.length];
    const slug=nombre.toLowerCase().replace(/\s+/g,'.');
    return {nombre,email:slug+'@seed.servired.com',password:passHash,roles:['TRABAJADOR'],rol:'TRABAJADOR',estado:'ACTIVO',disponible:true,verificado:true,especialidades:[r],rubro:r,ubicacion:{type:'Point',coordinates:[z[0]+(Math.random()-0.5)*0.05,z[1]+(Math.random()-0.5)*0.05]},telefono:'1160'+String(i).padStart(6,'0'),calificacion:parseFloat((4+Math.random()).toFixed(1)),totalTrabajos:Math.floor(Math.random()*80)+5};
  });
  const del = await Usuario.deleteMany({email:/@seed\.servired\.com$/});
  console.log('Eliminados anteriores:', del.deletedCount);
  const ins = await Usuario.insertMany(trabajadores,{ordered:false});
  console.log('Insertados:', ins.length);
  ins.slice(0,3).forEach(t=>console.log(' -',t.nombre,'|',t.rubro,'|',t.email));
  await mongoose.disconnect();
  console.log('Listo');
}
seed().catch(e=>{console.error('ERROR:',e.message);process.exit(1);});
