"use strict";

/**
 *
 * Form mysql query <br><br>
 *
 * @module lib/query_builder/mysql
 *
 */

var rootPrefix = '../..'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;

/**
 * Use following to test SELECT after any changes in file
 *
 *
 var mysqlQuery = require('./lib/query_builders/mysql');
 var mysqlWrapper = require('./lib/mysql_wrapper');
 var mysql = require('mysql');

 function queryBuilder() {
  return new mysqlQuery({table_name: tableName});
 }
 function onReadConnection() {
  return mysqlWrapper.getPoolFor(dbName, 'master');
 }
 function printQuery(query, queryData) {
  console.log(query);
  console.log(queryData);
  var sql = mysql.format(query, queryData);
  console.log(sql);
  return sql;
 }

 var dbName = 'saas_client_economy_sandbox_development';
 var tableName = 'client_branded_tokens';

 var queryResponse = queryBuilder().select().select().select(['client_id']).select(['id', 'name']).select('sum(id) as total').select('created_at').where(['id IN (?) AND created_at > ?', [1,2], '2018-02-19']).where(['symbol_icon IN (?) AND symbol IS ?', ['ST1', 'ST2'], null]).where('symbol IS NULL').where('name="ST1"').where({conversion_rate: 3, symbol: 'ST1'}).where({conversion_rate: 2}).group_by(['id','token_uuid']).group_by(['symbol']).group_by('name, created_at').group_by('updated_at').order_by('id ASC').having(['MIN(`id`) < ? and max(id) > ?', 20, 200]).having(['MIN(`id`) < ? and max(id) > ?', 10, 100]).having('SUM(`id`) < 10').having('SUM(`id`) < 100').order_by('client_id DESC').order_by(['name', 'reserve_managed_address_id']).order_by(['symbol']).order_by({id: 'asc', client_id: 'desc'}).order_by({symbol: 'AsC'}).limit(10).offset(20).generate();
 var finalQuery = printQuery(queryResponse.data.query, queryResponse.data.queryData);

 finalQuery == "SELECT client_branded_tokens.*, client_branded_tokens.*, `client_id`, `id`, `name`, sum(id) as total, created_at FROM `client_branded_tokens` WHERE (id IN (1, 2) AND created_at > '2018-02-19') AND (symbol_icon IN ('ST1', 'ST2') AND symbol IS NULL) AND (symbol IS NULL) AND (name=\"ST1\") AND (`conversion_rate`=3 AND `symbol`='ST1') AND (`conversion_rate`=2) GROUP BY `id`, `token_uuid`, `symbol`, name, created_at, updated_at HAVING (MIN(`id`) < 20 and max(id) > 200) AND (MIN(`id`) < 10 and max(id) > 100) AND (SUM(`id`) < 10) AND (SUM(`id`) < 100) ORDER BY id ASC, client_id DESC, `name`, `reserve_managed_address_id`, `symbol`, `id` ASC, `client_id` DESC, `symbol` ASC LIMIT 20, 10";
 *
 *
 */


/**
 *
 * MySQL query builder constructor
 *
 * @param {Object} params -
 * @param {String} [params.table_name] - MySQL table name for which query need to be build
 *
 * @constructor
 *
 */
const MySQLQueryBuilderKlass = function (params) {
  const oThis = this
  ;

  oThis.tableName = oThis.tableName || (params || {}).table_name;

  // Populate default parameters
  oThis.selectSubQueries = [];
  oThis.selectSubQueriesReplacement = [];

  oThis.whereSubQueries = [];
  oThis.whereSubQueriesReplacement = [];

  oThis.groupBySubQueries = [];
  oThis.groupBySubQueriesReplacement = [];

  oThis.orderBySubQueries = [];
  oThis.orderBySubQueriesReplacement = [];

  oThis.havingSubQueries = [];
  oThis.havingSubQueriesReplacement = [];

  oThis.selectLimit = 0;
  oThis.selectOffset = 0;

  oThis.insertIntoColumns = [];
  oThis.insertIntoColumnValues = [];
  oThis.insertOnDuplicateCondition = null;

  oThis.queryType = null;

  return oThis;
};

MySQLQueryBuilderKlass.prototype = {

  tableName: null,

  queryType: null,

  /**
   * Select query params
   *
   * Max supported select query:
   * SELECT [columns]
   *   FROM [table]
   *   WHERE [where conditions]
   *   GROUP BY [columns]
   *   ORDER BY [order by columns]
   *   HAVING [having condition]
   *   LIMIT [limit and offset]
   */
  selectSubQueries: null,
  selectSubQueriesReplacement: null,

  whereSubQueries: null,
  whereSubQueriesReplacement: null,

  groupBySubQueries: null,
  groupBySubQueriesReplacement: null,

  orderBySubQueries: null,
  orderBySubQueriesReplacement: null,

  havingSubQueries: null,
  havingSubQueriesReplacement: null,

  selectLimit: null,
  selectOffset: null,

  /**
   *
   */
  insertIntoColumns: null,
  insertIntoColumnValues: null,
  insertOnDuplicateCondition: null,

  /**
   * List of fields to be selected from table. If called multiple times, select columns will be joined by COMMA.
   *
   * Possible data types:
   * * blank/undefined - '*' will be used to fetch all columns
   * * Array - list of field names will be joined by comma
   * * String - list of field names will be used as it is
   *
   * Example 1: '*' will be used to fetch all columns
   * select()
   *
   * Example 2: list of field names in array. Will be joined by comma
   * select(['name', 'created_at'])
   *
   * Example 3: list of field names in string. Will be used as it is
   * select('name, created_at')
   *
   * @return {object<self>} oThis
   */
  select: function (fields) {
    const oThis = this
    ;

    if (![undefined, null, '', 'SELECT'].includes(oThis.queryType)) {
      throw "Multiple type of query statements in single query builder object";
    }

    oThis.queryType = "SELECT";

    if (fields === undefined || fields === '') {

      // if fields are not mentioned, fetch all columns
      oThis.selectSubQueries.push(oThis.tableName + ".*");

    } else if (Array.isArray(fields)) {

      // list of columns will be fetched
      oThis.selectSubQueries.push("??");
      oThis.selectSubQueriesReplacement.push(fields);

    } else if (typeof fields === 'string') {

      // custom columns list will be fetched
      oThis.selectSubQueries.push(fields);

    } else {
      throw "Unsupported data type for fields in select clause";
    }

    return oThis;
  },

  /**
   * Where conditions to be applied to the query. If called multiple times, where conditions will be joined by AND.
   *
   * Possible data types:
   * * Array - index 0 should have the where sub query and other indexes should have the valued to be replaced in sub query
   * * Object - key and value pairs of columns and values to be joined by AND to form where sub query
   * * String - where sub query, used as it is.
   *
   * Example 1: Where in array format
   * where(['name=? AND id=?', 'ACMA', 10])
   *
   * Example 2: Where in object format. Conditions will be joined by AND
   * where({name: 'ACMA', id: 10})
   *
   * Example 3: condition in string. Will be used as it is
   * where('id=10')
   *
   * @return {object<self>} oThis
   */
  where: function (whereConditions) {
    const oThis = this
    ;

    // validations
    if (whereConditions === undefined || whereConditions === '') {
      throw "Where condition can not be blank";
    }

    if (typeof whereConditions === 'string') {

      // simply push string to sub-queries array
      oThis.whereSubQueries.push(whereConditions);

    } else if (Array.isArray(whereConditions)) {

      // extract first element and push it to sub-queries array
      oThis.whereSubQueries.push(whereConditions.shift());

      // remain array will be concatenated at the end of replacement array
      if (whereConditions.length > 0) {
        oThis.whereSubQueriesReplacement = oThis.whereSubQueriesReplacement.concat(whereConditions);
      }

    } else if (typeof whereConditions === 'object') {

      // Extract keys and values in different arrays.
      // For sub-queries create string locally and push it to sub-queries array by joining with AND.
      // Also push key and value alternatively in local replacement array.
      var whereColumns = Object.keys(whereConditions)
        , whereValues = Object.values(whereConditions)
        , localSubQueries = []
        , localReplacements = [];


      if (whereColumns.length > 0) {
        for (var i = 0; i < whereColumns.length; i++) {
          localSubQueries.push("??=?");
          localReplacements.push(whereColumns[i]);
          localReplacements.push(whereValues[i]);
        }
        oThis.whereSubQueries.push(localSubQueries.join(' AND '));
        oThis.whereSubQueriesReplacement = oThis.whereSubQueriesReplacement.concat(localReplacements);
      } else {
        throw "Unsupported data type for WHERE clause";
      }

    } else {
      throw "Unsupported data type for WHERE clause";
    }

    return oThis;
  },

  /**
   * List of fields to be grouped by from table. If called multiple times, group by conditions will be joined by COMMA.
   *
   * Possible data types:
   * * Array - list of field names will be joined by comma
   * * String - list of field names will be used as it is
   *
   * Example 1:
   * group_by(['name', 'created_at'])
   *
   * Example 2:
   * group_by('name, created_at')
   *
   * @return {object<self>} oThis
   */
  group_by: function (groupByConditions) {
    const oThis = this
    ;

    // validations
    if (groupByConditions === undefined || groupByConditions === '') {
      throw "GROUP BY condition can not be blank";
    }

    if (Array.isArray(groupByConditions)) {

      // list of columns to be group by on
      oThis.groupBySubQueries.push("??");
      oThis.groupBySubQueriesReplacement.push(groupByConditions);

    } else if (typeof groupByConditions === 'string') {

      // custom columns list will be fetched
      oThis.groupBySubQueries.push(groupByConditions);

    } else {
      throw "Unsupported data type for GROUP BY";
    }

    return oThis;
  },

  /**
   * List of fields to be ordered by from table. If called multiple times, order by conditions will be joined by COMMA.
   *
   * Possible data types:
   * * Object - where keys are column names and value is order
   * * String - order will be used as it is
   *
   * Example 1:
   * order_by({'name': 'ASC', 'created_at': 'DESC'})
   *
   * Example 2:
   * order_by('name ASC, created_at DESC')
   *
   * Example 3:
   * order_by([1, 2, 3])
   *
   * @return {object<self>} oThis
   */
  order_by: function (orderByConditions) {
    const oThis = this
    ;

    // validations
    if (orderByConditions === undefined || orderByConditions === '') {
      throw "ORDER BY condition can not be blank";
    }

    if (Array.isArray(orderByConditions)) {

      // list of columns to be group by on
      oThis.orderBySubQueries.push("??");
      oThis.orderBySubQueriesReplacement.push(orderByConditions);

    } else if (typeof orderByConditions === 'object') {

      // Extract keys and values in different arrays.
      // For sub-queries create string locally and push it to sub-queries array by joining with COMMA.
      // Also push key and value alternatively in local replacement array.
      var orderColumns = Object.keys(orderByConditions)
        , orderValues = Object.values(orderByConditions)
        , localSubQueries = []
        , localReplacements = [];

      if (orderColumns.length > 0) {
        for (var i = 0; i < orderColumns.length; i++) {
          localSubQueries.push("?? " + (orderValues[i].toUpperCase() == "DESC" ? "DESC" : "ASC"));
          localReplacements.push(orderColumns[i]);
        }
        oThis.orderBySubQueries.push(localSubQueries.join(', '));
        oThis.orderBySubQueriesReplacement = oThis.orderBySubQueriesReplacement.concat(localReplacements);
      } else {
        throw "Unsupported data type for ORDER BY";
      }

    } else if (typeof orderByConditions === 'string') {

      // custom columns list will be fetched
      oThis.orderBySubQueries.push(orderByConditions);

    } else {
      throw "Unsupported data type for ORDER BY";
    }

    return oThis;
  },

  /**
   * List of fields for having clause. If called multiple times, having conditions will be joined by AND.
   *
   * Possible data types:
   * * Array - index 0 should have the having sub query and other indexes should have the valued to be replaced in sub query
   * * String - where sub query, used as it is.
   *
   * Example 1: Where in array format
   * having(['MIN(`salary`) < ?', 10])
   *
   * Example 2: condition in string. Will be used as it is
   * having('MIN(`salary`) < 10')
   *
   * @return {object<self>} oThis
   */
  having: function (havingConditions) {
    const oThis = this
    ;

    // validations
    if (havingConditions === undefined || havingConditions === '') {
      throw "HAVING condition can not be blank";
    }

    if (typeof havingConditions === 'string') {

      // simply push string to sub-queries array
      oThis.havingSubQueries.push(havingConditions);

    } else if (Array.isArray(havingConditions)) {

      // extract first element and push it to sub-queries array
      oThis.havingSubQueries.push(havingConditions.shift());

      // remaining array will be concatenated at the end of replacement array
      if (havingConditions.length > 0) {
        oThis.havingSubQueriesReplacement = oThis.havingSubQueriesReplacement.concat(havingConditions);
      }

    } else {
      throw "Unsupported data type for HAVING";
    }

    return oThis;
  },

  /**
   * Limit of records to be fetched. If called multiple times, it will overwrite the previous value
   *
   * Example 1:
   * limit(100)
   *
   * @param (number) recordsLimit - limit for select query
   *
   * @return {object<self>} oThis
   */
  limit: function (recordsLimit) {
    const oThis = this
    ;

    if (parseInt(recordsLimit) > 0) {

      // simply use the number in limit clause
      oThis.selectLimit = parseInt(recordsLimit);

    } else {
      throw "Unsupported data type for select LIMIT";
    }

    return oThis;
  },

  /**
   * Offset for records to be fetched. If called multiple times, it will overwrite the previous value. limit is mandatory for offset
   *
   * Example 1:
   * offset(10)
   *
   * @param (number) recordsOffset - offset for select query
   *
   * @return {object<self>} oThis
   */
  offset: function (recordsOffset) {
    const oThis = this
    ;

    if (parseInt(recordsOffset) > 0) {

      // simply use the number in limit clause
      oThis.selectOffset = parseInt(recordsOffset);

    } else {
      throw "Unsupported data type for select OFFSET";
    }

    return oThis;
  },

  /**
   * Insert multiple records in table
   *
   * Example 1:
   * insertMultiple(['name', 'symbol'], [['ABC', '123'], ['ABD', '456']])
   *
   * @param (array) insertColumns - list of columns. also columns are mandatory
   * @param (array) insertValues - array of array with values
   * @param (object) insertOptions -
   * @param (object) [insertOptions.touch] - if true, auto insert created_at and updated_at values. Default is true.
   * @param (object) [insertOptions.onDuplicateUpdate] - Allow string, array, object formats. Please refer update syntax for more details
   *
   * @return {object<self>} oThis
   */
  insertMultiple: function (insertColumns, insertValues, insertOptions) {
    const oThis = this
    ;

    if (![undefined, null, '', 'INSERT'].includes(oThis.queryType)) {
      throw "Multiple type of query statements in single query builder object";
    }

    oThis.queryType = "INSERT";

    if (!Array.isArray(insertColumns)) {
      throw "Unsupported insert columns data type";
    }

    if (!Array.isArray(insertValues) || insertColumns.length == 0) {
      throw "Unsupported insert values data type";
    }

    // insert columns can be left empty
    var totalColumnsToInsert = insertColumns.length;
    oThis.insertIntoColumns = totalColumnsToInsert > 0 ? insertColumns : [];

    // insert values
  },

  /**
   * Generate final query supported by mysql node module
   *
   * @return {object<response>}
   */
  generate: function () {
    const oThis = this
    ;

    if (oThis.queryType === "SELECT") {

      return oThis._generateSelect();

    } else if (oThis.queryType == "INSERT") {

    } else if (oThis.queryType == "UPDATE") {

    } else if (oThis.queryType == "DELETE") {

    } else if (oThis.queryType == "MIGRATION") {

    } else {
      throw "Unsupported query type";
    }
  },

  /**
   * Generate the final SELECT statement
   *
   * @private
   */
  _generateSelect: function () {
    const oThis = this
    ;

    var queryString = ""
      , queryData = [];

    // Select query generation starts
    queryString = oThis.queryType;

    // Select part of the query and it's data part
    if (oThis.selectSubQueries.length === 0) {
      // put * if no select mentioned ??
      throw "What do you want to select? Please mention.";
    }
    queryString += " " + oThis.selectSubQueries.join(', ');
    if (oThis.selectSubQueriesReplacement.length > 0) {
      queryData = queryData.concat(oThis.selectSubQueriesReplacement);
    }

    // If table name is present, generate the rest of the query and it's data
    if (oThis.tableName) {

      // from part of the query and it's data part
      queryString += " FROM ??";
      queryData.push(oThis.tableName);

      if (oThis.whereSubQueries.length > 0) {
        queryString += " WHERE (" + oThis.whereSubQueries.join(') AND (') + ")";
        queryData = queryData.concat(oThis.whereSubQueriesReplacement);
      }

      if (oThis.groupBySubQueries.length > 0) {
        queryString += " GROUP BY " + oThis.groupBySubQueries.join(', ');
        queryData = queryData.concat(oThis.groupBySubQueriesReplacement);
      }

      if (oThis.havingSubQueries.length > 0) {
        queryString += " HAVING (" + oThis.havingSubQueries.join(') AND (') + ")";
        queryData = queryData.concat(oThis.havingSubQueriesReplacement);
      }

      if (oThis.orderBySubQueries.length > 0) {
        queryString += " ORDER BY " + oThis.orderBySubQueries.join(', ');
        queryData = queryData.concat(oThis.orderBySubQueriesReplacement);
      }

      if (oThis.selectLimit > 0) {
        queryString += " LIMIT " + ((oThis.selectOffset > 0) ? oThis.selectOffset + ", " : "") + oThis.selectLimit;
      }

    }

    return responseHelper.successWithData({query: queryString, queryData: queryData});
  }
};

module.exports = MySQLQueryBuilderKlass;