import { Request, Response } from "express";
import Restaurant from "../models/restaurant";

const getRestaurant = async (req: Request, res: Response) => {
  try {
    const restaurantId = req.params.restaurantId;

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json(restaurant);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

const searchRestaurant = async (req: Request, res: Response) => {
  try {
    const city = req.params.city;

    const searchQuery = (req.query.searchQuery as string) || "";
    const selectedCuisines = (req.query.selectedCuisines as string) || "";
    const sortOption = (req.query.sortOption as string) || "lastUpdated";
    const page = parseInt(req.query.page as string) || 1;

    //* Se define el objeto de consulta que va a ser de tipo any, porque al ser muy diverso es dificil darle un tipo especifico
    let query: any = {};

    //* Se le agrega el campo city al objeto y su valor será una expresión regular que busca coincidencias parciales (case-insensitive)
    //* Esto quiere decir que sera insensible a mayúsculas. Es decir si es pizza o PizzA, lo encontrará igual
    query["city"] = new RegExp(city, "i");
    //* Se realiza la búsqueda en el modelo Restaurant de Mongoose con la función countDocuments y se le pasa la query
    const cityCheck = await Restaurant.countDocuments(query);

    if (cityCheck === 0) {
      return res.status(404).json({
        data: [],
        pagination: {
          total: 0,
          page: 1,
          pages: 1,
        },
      });
    }

    if (selectedCuisines) {
      //* Las cuisines (cocinas/tipos de comidas) vienen en query string, vienen separadas por comas por ejemplo 'pizzas,hamburguesas,tartas'
      //* Con split las convertimos a array, y luego armamos un nuevo array con map, donde guardamos las regexp de cada una para buscar
      //* nuevamente con case insensitive (insensible a mayusculas)
      const cuisinesArray = selectedCuisines
        .split(",")
        .map((cuisine) => new RegExp(cuisine, "i"));

      //* En el objeto query se agrega una llave cuisines cuyo valor es un objeto que contiene una llave $all, la cual es un operador de MongoDB
      //* que indica que lo que se busque debe coincidir con todos los elementos del array que se le pasa como valor, en este caso
      //* la busqueda devolverá todos los restaurantes que contengan una llave "cuisines" con todos los elementos contenidos en cuisinesArray
      query["cuisines"] = { $all: cuisinesArray };
    }

    if (searchQuery) {
      //* Se crea una expresión regular con el valor de searchQuery case-insensitive
      const searchRegex = new RegExp(searchQuery, "i");

      //* Se le agrega le atributo $or a la query. Este atributo indica a mongoDB que debe encontrar documentos que
      //* cumplan con almenos una de las condiciones especificadas en un array.
      query["$or"] = [
        //* Si el nombre coincide con la regex creada o
        { restaurantName: searchRegex },
        //* Si en el array de cuisines se encuentra la palabra/s buscada/s (representada/s mediante la regex creada)
        //* $in también es un operador de mongoDB y es para ver si un valor esta dentro de un array
        { cuisines: { $in: [searchRegex] } },
      ];
    }

    //* Cantidad de resultados por página
    const pageSize = 10;
    //* Cantidad de resultados a saltear para matchear con el número de página
    const skip = (page - 1) * pageSize;

    const restaurants = await Restaurant.find(query)
      //* Se ordenan los resultados en base a la sortOption que por defecto es lastUpdated (el último actualizado)
      //* el 1 indica que se ordenará de forma ascendente (Descendente sería -1)
      .sort({ [sortOption]: 1 })
      //* Skip son la cantidad de resultados que se skipean(saltean/saltan). Si es la página 1 skip sera 0, es decir no
      //* se saltará ningun resultado. Si es la página 2, se saltarán los primeros 10 ((2-1) = 1 * 10 = 10). Y asi sucesivamente
      .skip(skip)
      //* Se limita la cantidad de resultados que se mostrarán ( en este caso 10)
      .limit(pageSize)
      //* Lean convierte la instancia de modelo de mongoose en objetos puros de Javascript
      .lean();

    const total = await Restaurant.countDocuments(query);

    const response = {
      data: restaurants,
      pagination: {
        //* Total de resultados
        total,
        //* Página actual
        page,
        //* Total de páginas. Se usa Math.ceil porque si la operación tiene resto quiere decir que hay una página más que no estará completa
        //* Por ejemplo si hay 34 resultados, habrá 4 páginas, 3 con 10 resultados y una con 4.
        pages: Math.ceil(total / pageSize),
      },
    };

    res.json(response);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

export default {
  getRestaurant,
  searchRestaurant,
};
